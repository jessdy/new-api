package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestLoadOrPersistCryptoSecretSurvivesRestart(t *testing.T) {
	t.Setenv("CRYPTO_SECRET", "")
	t.Setenv("SESSION_SECRET", "")

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Option{}))
	previousDB := DB
	previousSecret := common.CryptoSecret
	previousMaster := common.IsMasterNode
	DB = db
	common.IsMasterNode = true
	t.Cleanup(func() {
		DB = previousDB
		common.CryptoSecret = previousSecret
		common.IsMasterNode = previousMaster
	})

	common.CryptoSecret = "generated-once-secret"
	require.NoError(t, LoadOrPersistCryptoSecret())

	common.CryptoSecret = "rotated-on-restart"
	require.NoError(t, LoadOrPersistCryptoSecret())
	assert.Equal(t, "generated-once-secret", common.CryptoSecret)
}

func TestLoadOrPersistCryptoSecretRespectsEnv(t *testing.T) {
	t.Setenv("CRYPTO_SECRET", "from-env")
	t.Setenv("SESSION_SECRET", "")

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Option{}))
	require.NoError(t, db.Create(&Option{Key: cryptoSecretOptionKey, Value: "from-db"}).Error)

	previousDB := DB
	previousSecret := common.CryptoSecret
	DB = db
	common.CryptoSecret = "from-env"
	t.Cleanup(func() {
		DB = previousDB
		common.CryptoSecret = previousSecret
	})

	require.NoError(t, LoadOrPersistCryptoSecret())
	assert.Equal(t, "from-env", common.CryptoSecret)
}
