package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
		InviteCode: "bindme",
		Status:     AgentStatusEnabled,
	}
	require.NoError(t, CreateAgent(agent))
	found, err := GetAgentByInviteCode("bindme")
	require.NoError(t, err)
	assert.Equal(t, agent.Id, found.Id)
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
