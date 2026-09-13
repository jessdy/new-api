package model

import (
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func newAgentTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(
		&Agent{},
		&AgentChannel{},
		&AgentGroup{},
		&AgentModelPrice{},
		&AgentUserModelSetting{},
		&AgentSettlementBill{},
		&User{},
		&Channel{},
	))
	previous := DB
	DB = db
	t.Cleanup(func() { DB = previous })
	return db
}

func TestAgentChannelSelectionAndPricing(t *testing.T) {
	newAgentTestDB(t)

	agent := &Agent{
		UserId:      11,
		Name:        "reseller-a",
		InviteCode:  "agentcode",
		Status:      AgentStatusEnabled,
		CreditLimit: 1000,
	}
	require.NoError(t, CreateAgent(agent))
	require.NoError(t, EnsureAgentDefaultGroup(agent.Id))
	require.NoError(t, ReplaceAgentChannels(agent.Id, []int{1, 3}))

	ids, err := ListAgentChannelIds(agent.Id)
	require.NoError(t, err)
	assert.ElementsMatch(t, []int{1, 3}, ids)

	require.NoError(t, UpsertAgentModelPrice(&AgentModelPrice{
		AgentId:       agent.Id,
		Model:         "gpt-4",
		DiscountRatio: 1.2,
	}))
	discount, ok := GetAgentModelDiscount(agent.Id, "gpt-4")
	require.True(t, ok)
	assert.Equal(t, 1.2, discount)

	require.NoError(t, UpsertAgentModelCost(agent.Id, "gpt-4", 0.8))
	cost, ok := GetAgentModelCostRatio(agent.Id, "gpt-4")
	require.True(t, ok)
	assert.Equal(t, 0.8, cost)
	discount, ok = GetAgentModelDiscount(agent.Id, "gpt-4")
	require.True(t, ok)
	assert.Equal(t, 1.2, discount)

	require.NoError(t, AccrueAgentSettlementDebt(agent.Id, 250))
	loaded, err := GetAgentById(agent.Id)
	require.NoError(t, err)
	assert.Equal(t, int64(250), loaded.SettlementDebt)
	assert.True(t, loaded.IsRequestAllowed())

	require.NoError(t, AccrueAgentSettlementDebt(agent.Id, 800))
	loaded, err = GetAgentById(agent.Id)
	require.NoError(t, err)
	assert.False(t, loaded.IsRequestAllowed())
}

func TestAgentInviteBinding(t *testing.T) {
	newAgentTestDB(t)
	agent := &Agent{
		UserId:     21,
		Name:       "reseller-b",
		InviteCode: "BindMe",
		Status:     AgentStatusEnabled,
	}
	require.NoError(t, CreateAgent(agent))
	found, err := GetAgentByInviteCode("BINDME")
	require.NoError(t, err)
	assert.Equal(t, agent.Id, found.Id)
	assert.Equal(t, "bindme", found.InviteCode)

	binding := ResolveRegistrationInvite("BindMe")
	assert.Equal(t, agent.Id, binding.AgentId)

	invited := User{
		Username: "invited-user",
		Password: "placeholder",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Group:    "default",
		AffCode:  "inv1",
		AgentId:  agent.Id,
	}
	require.NoError(t, DB.Create(&invited).Error)
	viaAff := User{
		Username:  "via-aff",
		Password:  "placeholder",
		Role:      common.RoleCommonUser,
		Status:    common.UserStatusEnabled,
		Group:     "default",
		AffCode:   "inv2",
		InviterId: agent.UserId,
	}
	require.NoError(t, DB.Create(&viaAff).Error)

	users, total, err := ListUsersByAgentId(agent.Id, 0, 20)
	require.NoError(t, err)
	assert.Equal(t, int64(2), total)
	require.Len(t, users, 2)
	ids := []int{users[0].Id, users[1].Id}
	assert.ElementsMatch(t, []int{invited.Id, viaAff.Id}, ids)
}

func TestListUsersByAgentIdPostgres(t *testing.T) {
	dsn := strings.TrimSpace(os.Getenv("TEST_POSTGRES_DSN"))
	if dsn == "" {
		t.Skip("TEST_POSTGRES_DSN is not configured")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	require.NoError(t, db.AutoMigrate(&Agent{}, &User{}))
	previous := DB
	DB = db
	t.Cleanup(func() { DB = previous })

	owner := User{
		Username: "pg-agent-owner",
		Password: "placeholder",
		Role:     common.RoleAgentUser,
		Status:   common.UserStatusEnabled,
		Group:    "default",
		AffCode:  "pgow",
	}
	require.NoError(t, DB.Create(&owner).Error)
	agent := &Agent{
		UserId:     owner.Id,
		Name:       "pg-list",
		InviteCode: "pglist",
		Status:     AgentStatusEnabled,
	}
	require.NoError(t, CreateAgent(agent))
	member := User{
		Username: "pg-member",
		Password: "placeholder",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Group:    "default",
		AffCode:  "pgmb",
		AgentId:  agent.Id,
	}
	require.NoError(t, DB.Create(&member).Error)

	users, total, err := ListUsersByAgentId(agent.Id, 0, 20)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, users, 1)
	assert.Equal(t, member.Id, users[0].Id)
	assert.Equal(t, "default", users[0].Group)
}

func TestAgentSalesInviteInheritsAgent(t *testing.T) {
	newAgentTestDB(t)
	agentUser := User{
		Username: "agent-owner",
		Password: "placeholder",
		Role:     common.RoleAgentUser,
		Status:   common.UserStatusEnabled,
		Group:    "default",
		AffCode:  "ownr",
	}
	require.NoError(t, DB.Create(&agentUser).Error)
	agent := &Agent{
		UserId:     agentUser.Id,
		Name:       "reseller-sales",
		InviteCode: "salesorg",
		Status:     AgentStatusEnabled,
	}
	require.NoError(t, CreateAgent(agent))

	sales := User{
		Username:        "sales-bob",
		Password:        "placeholder",
		Role:            common.RoleCommonUser,
		Status:          common.UserStatusEnabled,
		Group:           "default",
		AffCode:         "bob1",
		AgentId:         agent.Id,
		AgentMemberRole: AgentMemberRoleSales,
	}
	require.NoError(t, DB.Create(&sales).Error)

	binding := ResolveRegistrationInvite("bob1")
	assert.Equal(t, sales.Id, binding.InviterId)
	assert.Equal(t, agent.Id, binding.AgentId)

	customer := User{
		Username:  "end-user-cara",
		Password:  "placeholder",
		Role:      common.RoleCommonUser,
		Status:    common.UserStatusEnabled,
		Group:     "default",
		AffCode:   "cara",
		InviterId: sales.Id,
	}
	require.NoError(t, DB.Create(&customer).Error)

	users, total, err := ListUsersByAgentId(agent.Id, 0, 20)
	require.NoError(t, err)
	assert.Equal(t, int64(2), total)
	ids := []int{users[0].Id, users[1].Id}
	assert.ElementsMatch(t, []int{sales.Id, customer.Id}, ids)
	byID := map[int]AgentManagedUser{users[0].Id: users[0], users[1].Id: users[1]}
	assert.Equal(t, AgentMemberRoleSales, byID[sales.Id].AgentMemberRole)
	assert.Equal(t, AgentMemberRoleUser, byID[customer.Id].AgentMemberRole)
	assert.Equal(t, sales.Username, byID[customer.Id].InviterUsername)
	reloaded, err := GetUserById(customer.Id, false)
	require.NoError(t, err)
	assert.Equal(t, agent.Id, reloaded.AgentId)
}

func assertAgentMemberRoleColumn(t *testing.T, db *gorm.DB) {
	t.Helper()
	require.NoError(t, db.AutoMigrate(&User{}))
	require.True(t, db.Migrator().HasColumn(&User{}, "AgentMemberRole"))
	require.NoError(t, db.AutoMigrate(&User{}))
	if db.Migrator().HasColumn(&User{}, "AgentMemberRole") {
		require.NoError(t, db.Migrator().DropColumn(&User{}, "AgentMemberRole"))
	}
	require.NoError(t, db.Exec(
		"INSERT INTO users (username, password, aff_code, agent_id) VALUES (?, ?, ?, ?)",
		"legacy-member", "placeholder", "leg1", 3,
	).Error)
	require.NoError(t, db.AutoMigrate(&User{}))
	require.True(t, db.Migrator().HasColumn(&User{}, "AgentMemberRole"))
	var loaded User
	require.NoError(t, db.Where("username = ?", "legacy-member").First(&loaded).Error)
	assert.Equal(t, "legacy-member", loaded.Username)
	assert.Equal(t, 3, loaded.AgentId)
	require.NoError(t, db.AutoMigrate(&User{}))
}

func TestAgentMemberRoleColumnSQLite(t *testing.T) {
	assertAgentMemberRoleColumn(t, newAgentTestDB(t))
}

func TestBindUserToInviteAgentFromSalesTree(t *testing.T) {
	newAgentTestDB(t)
	agentUser := User{
		Username: "agent-owner-2",
		Password: "placeholder",
		Role:     common.RoleAgentUser,
		Status:   common.UserStatusEnabled,
		Group:    "default",
		AffCode:  "own2",
	}
	require.NoError(t, DB.Create(&agentUser).Error)
	agent := &Agent{
		UserId:     agentUser.Id,
		Name:       "reseller-pay",
		InviteCode: "payorg",
		Status:     AgentStatusEnabled,
	}
	require.NoError(t, CreateAgent(agent))

	sales := User{
		Username:        "sales-pay",
		Password:        "placeholder",
		Role:            common.RoleCommonUser,
		Status:          common.UserStatusEnabled,
		Group:           "default",
		AffCode:         "spay",
		AgentId:         agent.Id,
		AgentMemberRole: AgentMemberRoleSales,
	}
	require.NoError(t, DB.Create(&sales).Error)
	customer := User{
		Username:  "pay-customer",
		Password:  "placeholder",
		Role:      common.RoleCommonUser,
		Status:    common.UserStatusEnabled,
		Group:     "default",
		AffCode:   "pcus",
		InviterId: sales.Id,
	}
	require.NoError(t, DB.Create(&customer).Error)

	require.NoError(t, BindUserToInviteAgent(&customer))
	assert.Equal(t, agent.Id, customer.AgentId)
	reloaded, err := GetUserById(customer.Id, false)
	require.NoError(t, err)
	assert.Equal(t, agent.Id, reloaded.AgentId)
	assert.Equal(t, AgentMemberRoleUser, NormalizeAgentMemberRole(reloaded.AgentMemberRole))
}

func TestAgentChannelFilter(t *testing.T) {
	ch := &Channel{Id: 7, Status: common.ChannelStatusEnabled}
	ok, kind := ChannelSatisfiesFilters(ch, "gpt-4", []dto.ChannelFilter{{
		Kind:              dto.FilterAgentChannels,
		AllowedChannelIds: []int{1, 7},
	}})
	assert.True(t, ok)
	assert.Equal(t, dto.ChannelFilterKind(""), kind)

	ok, kind = ChannelSatisfiesFilters(ch, "gpt-4", []dto.ChannelFilter{{
		Kind:              dto.FilterAgentChannels,
		AllowedChannelIds: []int{1, 2},
	}})
	assert.False(t, ok)
	assert.Equal(t, dto.FilterAgentChannels, kind)
}

func TestAgentPaymentConfigRoundTrip(t *testing.T) {
	previousSecret := common.CryptoSecret
	common.CryptoSecret = "agent-payment-test-secret-value"
	t.Cleanup(func() { common.CryptoSecret = previousSecret })

	newAgentTestDB(t)
	agent := &Agent{
		UserId:     31,
		Name:       "pay-agent",
		InviteCode: "paycode",
		Status:     AgentStatusEnabled,
	}
	require.NoError(t, CreateAgent(agent))
	require.NoError(t, agent.SetPaymentConfig(AgentPaymentConfig{
		EpayEnabled: true,
		PayAddress:  "https://pay.example.com",
		EpayId:      "pid",
		EpayKey:     "secret-key",
	}))
	loaded, err := GetAgentById(agent.Id)
	require.NoError(t, err)
	cfg, err := loaded.GetPaymentConfig()
	require.NoError(t, err)
	assert.True(t, cfg.EpayEnabled)
	assert.Equal(t, "secret-key", cfg.EpayKey)
	view := cfg.PublicView()
	assert.Equal(t, true, view["epay_key_set"])
	assert.NotContains(t, view, "epay_key")
}

func TestReplaceAgentGroupPricingBecomesUserPricing(t *testing.T) {
	newAgentTestDB(t)
	agent := &Agent{
		UserId:     41,
		Name:       "price-agent",
		InviteCode: "pricecode",
		Status:     AgentStatusEnabled,
	}
	require.NoError(t, CreateAgent(agent))

	require.NoError(t, ReplaceAgentGroupPricing(agent.Id, AgentGroupPricingView{
		GroupRatio: map[string]float64{
			"default": 1,
			"vip":     0.5,
		},
		TopupGroupRatio: map[string]float64{
			"default": 1,
			"vip":     1.2,
		},
		UserUsableGroups: map[string]string{
			"default": "Default",
			"vip":     "VIP",
		},
		GroupGroupRatio: map[string]map[string]float64{
			"vip": {"default": 0.8},
		},
		AutoGroups:          []string{"vip", "default"},
		MaxTokenAutoGroups:  2,
		DefaultUseAutoGroup: true,
		GroupSpecialUsableGroup: map[string]map[string]string{
			"vip": {"+:hidden": "Hidden"},
		},
	}))

	view, err := GetAgentGroupPricingView(agent.Id)
	require.NoError(t, err)
	assert.Equal(t, 0.5, view.GroupRatio["vip"])
	assert.Equal(t, 1.2, view.TopupGroupRatio["vip"])
	assert.Equal(t, "VIP", view.UserUsableGroups["vip"])
	assert.Equal(t, 0.8, view.GroupGroupRatio["vip"]["default"])
	assert.Equal(t, []string{"vip", "default"}, view.AutoGroups)
	assert.True(t, view.DefaultUseAutoGroup)

	ratio, ok := GetAgentGroupGroupRatio(agent.Id, "vip", "default")
	require.True(t, ok)
	assert.Equal(t, 0.8, ratio)

	vip, err := GetAgentGroup(agent.Id, "vip")
	require.NoError(t, err)
	assert.True(t, vip.Selectable)
	assert.Equal(t, "VIP", vip.Description)
}

func TestListAgentModelsMergesChannelsAndCost(t *testing.T) {
	newAgentTestDB(t)
	require.NoError(t, DB.Create(&Channel{
		Id: 1, Name: "east", Key: "k1", Models: "gpt-4,claude-3", Status: common.ChannelStatusEnabled,
	}).Error)
	require.NoError(t, DB.Create(&Channel{
		Id: 2, Name: "west", Key: "k2", Models: "gpt-4,gemini", Status: common.ChannelStatusEnabled,
	}).Error)

	agent := &Agent{
		UserId:     31,
		Name:       "models-agent",
		InviteCode: "modelsag",
		Status:     AgentStatusEnabled,
	}
	require.NoError(t, CreateAgent(agent))
	require.NoError(t, ReplaceAgentChannels(agent.Id, []int{1, 2}))
	require.NoError(t, UpsertAgentModelCost(agent.Id, "gpt-4", 0.75))
	require.NoError(t, UpsertAgentModelCost(agent.Id, "legacy-only", 1.1))

	items, err := ListAgentModels(agent.Id)
	require.NoError(t, err)
	byName := map[string]AgentModelListItem{}
	for _, item := range items {
		byName[item.ModelName] = item
	}
	require.Contains(t, byName, "gpt-4")
	require.Contains(t, byName, "claude-3")
	require.Contains(t, byName, "gemini")
	require.Contains(t, byName, "legacy-only")
	assert.Equal(t, 0.75, byName["gpt-4"].CostRatio)
	assert.True(t, byName["gpt-4"].HasCostOverride)
	assert.ElementsMatch(t, []string{"east", "west"}, byName["gpt-4"].ChannelNames)
	assert.Equal(t, 1.0, byName["claude-3"].CostRatio)
	assert.False(t, byName["claude-3"].HasCostOverride)
	assert.Equal(t, 1.1, byName["legacy-only"].CostRatio)
}

func TestReplaceAgentUserModelSettings(t *testing.T) {
	newAgentTestDB(t)
	require.NoError(t, DB.Create(&Channel{
		Id: 1, Name: "east", Key: "k1", Models: "gpt-4,claude-3", Status: common.ChannelStatusEnabled,
	}).Error)
	agent := &Agent{
		UserId: 41, Name: "user-models", InviteCode: "usermod", Status: AgentStatusEnabled,
	}
	require.NoError(t, CreateAgent(agent))
	require.NoError(t, ReplaceAgentChannels(agent.Id, []int{1}))
	require.NoError(t, DB.Create(&User{
		Id: 501, Username: "cust", Password: "x", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AffCode: "c1", AgentId: agent.Id,
	}).Error)

	require.NoError(t, ReplaceAgentUserModelSettings(agent.Id, 501, AgentUserModelSettingsPayload{
		LimitEnabled: true,
		Models: []AgentUserModelSettingInput{
			{
				ModelName: "gpt-4",
				Enabled:   true,
				Pricing:   PricingValues{"ModelRatio": 2.5, "CompletionRatio": 2},
			},
			{ModelName: "claude-3", Enabled: false},
		},
	}))

	limited, err := AgentUserHasModelLimit(501)
	require.NoError(t, err)
	assert.True(t, limited)
	allowed, err := AgentUserAllowsModel(501, "gpt-4")
	require.NoError(t, err)
	assert.True(t, allowed)
	allowed, err = AgentUserAllowsModel(501, "claude-3")
	require.NoError(t, err)
	assert.False(t, allowed)
	pricing, ok := GetAgentUserModelPricing(501, "gpt-4")
	require.True(t, ok)
	assert.Equal(t, 2.5, pricing["ModelRatio"])

	require.NoError(t, ReplaceAgentUserModelSettings(agent.Id, 501, AgentUserModelSettingsPayload{
		LimitEnabled: false,
	}))
	limited, err = AgentUserHasModelLimit(501)
	require.NoError(t, err)
	assert.False(t, limited)
	allowed, err = AgentUserAllowsModel(501, "claude-3")
	require.NoError(t, err)
	assert.True(t, allowed)
}
