package model

import (
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type tokenPeriodQuotaLegacy struct {
	Id             int    `gorm:"primaryKey"`
	UserId         int    `gorm:"index"`
	Key            string `gorm:"type:varchar(128);uniqueIndex"`
	Status         int    `gorm:"default:1"`
	Name           string `gorm:"index"`
	CreatedTime    int64  `gorm:"bigint"`
	AccessedTime   int64  `gorm:"bigint"`
	ExpiredTime    int64  `gorm:"bigint;default:-1"`
	RemainQuota    int    `gorm:"default:0"`
	UnlimitedQuota bool
	UsedQuota      int    `gorm:"default:0"`
	Group          string `gorm:"default:''"`
}

func TestQuotaPeriodStartUsesLocalCalendar(t *testing.T) {
	now := time.Date(2026, 3, 15, 18, 30, 0, 0, time.Local).Unix()
	dayStart := time.Date(2026, 3, 15, 0, 0, 0, 0, time.Local).Unix()
	monthStart := time.Date(2026, 3, 1, 0, 0, 0, 0, time.Local).Unix()

	assert.Equal(t, dayStart, QuotaPeriodStart(TokenQuotaPeriodDay, now))
	assert.Equal(t, monthStart, QuotaPeriodStart(TokenQuotaPeriodMonth, now))
	assert.Equal(t, int64(0), QuotaPeriodStart("", now))
}

func TestApplyQuotaPeriodNormalizesCreateAndUpdate(t *testing.T) {
	now := time.Date(2026, 3, 15, 12, 0, 0, 0, time.Local).Unix()

	created := Token{QuotaPeriod: TokenQuotaPeriodDay, RemainQuota: 80}
	require.NoError(t, created.ApplyQuotaPeriod(nil, now))
	assert.Equal(t, TokenQuotaPeriodDay, created.QuotaPeriod)
	assert.Equal(t, 80, created.PeriodQuota)
	assert.Equal(t, 80, created.RemainQuota)
	assert.Equal(t, QuotaPeriodStart(TokenQuotaPeriodDay, now), created.PeriodResetAt)
	assert.False(t, created.UnlimitedQuota)

	previous := created
	previous.RemainQuota = 20
	unchanged := Token{QuotaPeriod: TokenQuotaPeriodDay, PeriodQuota: 80, RemainQuota: 80}
	require.NoError(t, unchanged.ApplyQuotaPeriod(&previous, now))
	assert.Equal(t, 20, unchanged.RemainQuota)
	assert.Equal(t, previous.PeriodResetAt, unchanged.PeriodResetAt)

	increased := Token{QuotaPeriod: TokenQuotaPeriodDay, PeriodQuota: 120, RemainQuota: 120}
	require.NoError(t, increased.ApplyQuotaPeriod(&previous, now))
	assert.Equal(t, 120, increased.RemainQuota)
	assert.Equal(t, 120, increased.PeriodQuota)

	cleared := Token{QuotaPeriod: "", RemainQuota: 15, UnlimitedQuota: false}
	require.NoError(t, cleared.ApplyQuotaPeriod(&previous, now))
	assert.Equal(t, "", cleared.QuotaPeriod)
	assert.Equal(t, 0, cleared.PeriodQuota)
	assert.Equal(t, int64(0), cleared.PeriodResetAt)
	assert.Equal(t, 15, cleared.RemainQuota)

	assert.ErrorIs(t, (&Token{QuotaPeriod: "week", RemainQuota: 10}).ApplyQuotaPeriod(nil, now), ErrTokenQuotaPeriodInvalid)
	assert.ErrorIs(t, (&Token{QuotaPeriod: TokenQuotaPeriodDay}).ApplyQuotaPeriod(nil, now), ErrTokenPeriodQuotaInvalid)
	assert.ErrorIs(t, (&Token{QuotaPeriod: TokenQuotaPeriodMonth, PeriodQuota: 10, UnlimitedQuota: true}).ApplyQuotaPeriod(nil, now), ErrTokenQuotaPeriodUnlimited)
}

func TestRefreshPeriodQuotaRefillsOncePerPeriod(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)

	now := time.Date(2026, 3, 15, 10, 0, 0, 0, time.Local).Unix()
	yesterday := time.Date(2026, 3, 14, 0, 0, 0, 0, time.Local).Unix()
	token := Token{
		UserId:        1,
		Key:           "period-reset-" + common.GetRandomString(8),
		Name:          "period-reset",
		Status:        common.TokenStatusExhausted,
		ExpiredTime:   -1,
		RemainQuota:   0,
		QuotaPeriod:   TokenQuotaPeriodDay,
		PeriodQuota:   50,
		PeriodResetAt: yesterday,
	}
	require.NoError(t, token.Insert())

	changed, err := token.RefreshPeriodQuota(now)
	require.NoError(t, err)
	assert.True(t, changed)
	assert.Equal(t, 50, token.RemainQuota)
	assert.Equal(t, QuotaPeriodStart(TokenQuotaPeriodDay, now), token.PeriodResetAt)
	assert.Equal(t, common.TokenStatusEnabled, token.Status)

	reloaded := getTokenFromDB(t, token.Id)
	assert.Equal(t, 50, reloaded.RemainQuota)
	assert.Equal(t, token.PeriodResetAt, reloaded.PeriodResetAt)
	assert.Equal(t, common.TokenStatusEnabled, reloaded.Status)

	changed, err = token.RefreshPeriodQuota(now)
	require.NoError(t, err)
	assert.False(t, changed)
	assert.Equal(t, 50, getTokenFromDB(t, token.Id).RemainQuota)
}

func TestPeriodQuotaAllowsUseAfterRollover(t *testing.T) {
	truncateTables(t)
	resetBatchUpdateTestState(t)

	now := time.Date(2026, 4, 1, 1, 0, 0, 0, time.Local).Unix()
	lastMonth := time.Date(2026, 3, 1, 0, 0, 0, 0, time.Local).Unix()
	token := Token{
		UserId:        1,
		Key:           "period-use-" + common.GetRandomString(8),
		Name:          "period-use",
		Status:        common.TokenStatusEnabled,
		ExpiredTime:   -1,
		RemainQuota:   0,
		QuotaPeriod:   TokenQuotaPeriodMonth,
		PeriodQuota:   40,
		PeriodResetAt: lastMonth,
	}
	require.NoError(t, token.Insert())

	assert.Equal(t, 40, token.EffectiveRemainQuota(now))

	validated, err := ValidateUserToken(token.Key)
	require.NoError(t, err)
	assert.Equal(t, 40, validated.RemainQuota)
	assert.Equal(t, common.TokenStatusEnabled, validated.Status)

	ok, err := TryReserveTokenQuota(token.Id, token.Key, 15, false)
	require.NoError(t, err)
	assert.True(t, ok)
	assert.Equal(t, 25, getTokenFromDB(t, token.Id).RemainQuota)
	assert.Equal(t, 15, getTokenFromDB(t, token.Id).UsedQuota)
}

func TestTokenPeriodQuotaRoundTripThroughRedisHashCache(t *testing.T) {
	useUserCacheMiniRedis(t)
	token := Token{
		Id:            9,
		UserId:        3,
		Key:           "period-cache-key",
		Name:          "period-cache",
		RemainQuota:   40,
		QuotaPeriod:   TokenQuotaPeriodDay,
		PeriodQuota:   77,
		PeriodResetAt: 1_700_000_000,
	}
	require.NoError(t, cacheSetTokenForTest(token))
	cached, err := cacheGetTokenByKey(token.Key)
	require.NoError(t, err)
	assert.Equal(t, TokenQuotaPeriodDay, cached.QuotaPeriod)
	assert.Equal(t, 77, cached.PeriodQuota)
	assert.Equal(t, int64(1_700_000_000), cached.PeriodResetAt)
	assert.Equal(t, 40, cached.RemainQuota)
}

func TestTokenPeriodQuotaColumnsFreshAndUpgrade(t *testing.T) {
	t.Run("sqlite", func(t *testing.T) {
		db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
		require.NoError(t, err)
		runTokenPeriodQuotaColumnMatrix(t, db)
	})

	if dsn := strings.TrimSpace(os.Getenv("TEST_MYSQL_DSN")); dsn != "" {
		t.Run("mysql", func(t *testing.T) {
			db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
			runTokenPeriodQuotaColumnMatrix(t, db)
		})
	}

	if dsn := strings.TrimSpace(os.Getenv("TEST_POSTGRES_DSN")); dsn != "" {
		t.Run("postgres", func(t *testing.T) {
			db, err := gorm.Open(postgres.New(postgres.Config{
				DSN:                  dsn,
				PreferSimpleProtocol: true,
			}), &gorm.Config{})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
			runTokenPeriodQuotaColumnMatrix(t, db)
		})
	}
}

func runTokenPeriodQuotaColumnMatrix(t *testing.T, db *gorm.DB) {
	t.Helper()
	runTokenPeriodQuotaFreshMigrate(t, db)
	runTokenPeriodQuotaUpgradeMigrate(t, db)
}

func runTokenPeriodQuotaFreshMigrate(t *testing.T, db *gorm.DB) {
	t.Helper()
	tableName := fmt.Sprintf("token_period_fresh_%d", time.Now().UnixNano())
	tableDB := db.Table(tableName)
	t.Cleanup(func() { _ = db.Migrator().DropTable(tableName) })

	for range 2 {
		require.NoError(t, tableDB.AutoMigrate(&Token{}))
	}
	require.True(t, db.Migrator().HasColumn(tableName, "quota_period"))
	require.True(t, db.Migrator().HasColumn(tableName, "period_quota"))
	require.True(t, db.Migrator().HasColumn(tableName, "period_reset_at"))

	token := Token{
		UserId:      3,
		Key:         "fresh-period-" + common.GetRandomString(8),
		Name:        "fresh-period",
		Status:      common.TokenStatusEnabled,
		ExpiredTime: -1,
		RemainQuota: 30,
		QuotaPeriod: TokenQuotaPeriodDay,
		PeriodQuota: 30,
	}
	require.NoError(t, token.ApplyQuotaPeriod(nil, common.GetTimestamp()))
	require.NoError(t, tableDB.Create(&token).Error)

	var stored Token
	require.NoError(t, tableDB.Where("name = ?", "fresh-period").First(&stored).Error)
	assert.Equal(t, TokenQuotaPeriodDay, stored.QuotaPeriod)
	assert.Equal(t, 30, stored.PeriodQuota)
	assert.Equal(t, 30, stored.RemainQuota)
	assert.Greater(t, stored.PeriodResetAt, int64(0))
}

func runTokenPeriodQuotaUpgradeMigrate(t *testing.T, db *gorm.DB) {
	t.Helper()
	tableName := fmt.Sprintf("token_period_upgrade_%d", time.Now().UnixNano())
	t.Cleanup(func() { _ = db.Migrator().DropTable(tableName) })

	require.NoError(t, db.Table(tableName).AutoMigrate(&tokenPeriodQuotaLegacy{}))
	require.NoError(t, db.Table(tableName).Create(&tokenPeriodQuotaLegacy{
		UserId:         4,
		Key:            "legacy-period-" + common.GetRandomString(8),
		Status:         common.TokenStatusEnabled,
		Name:           "legacy-period",
		CreatedTime:    1,
		AccessedTime:   1,
		ExpiredTime:    -1,
		RemainQuota:    12,
		UnlimitedQuota: false,
	}).Error)

	for range 2 {
		require.NoError(t, db.Table(tableName).AutoMigrate(&Token{}))
	}
	require.True(t, db.Migrator().HasColumn(tableName, "quota_period"))
	require.True(t, db.Migrator().HasColumn(tableName, "period_quota"))
	require.True(t, db.Migrator().HasColumn(tableName, "period_reset_at"))

	var upgraded Token
	require.NoError(t, db.Table(tableName).Where("name = ?", "legacy-period").First(&upgraded).Error)
	assert.Equal(t, 12, upgraded.RemainQuota)
	assert.Equal(t, "", upgraded.QuotaPeriod)
	assert.Equal(t, 0, upgraded.PeriodQuota)
	assert.Equal(t, int64(0), upgraded.PeriodResetAt)
}
