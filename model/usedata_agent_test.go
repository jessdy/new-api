package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetQuotaDataGroupByAgent(t *testing.T) {
	newAgentTestDB(t)
	require.NoError(t, DB.AutoMigrate(&QuotaData{}))

	agentA := &Agent{
		UserId:     101,
		Name:       "agent-a",
		InviteCode: "agenta",
		Status:     AgentStatusEnabled,
	}
	agentB := &Agent{
		UserId:     102,
		Name:       "agent-b",
		InviteCode: "agentb",
		Status:     AgentStatusEnabled,
	}
	require.NoError(t, CreateAgent(agentA))
	require.NoError(t, CreateAgent(agentB))
	require.NoError(t, ReplaceAgentChannels(agentA.Id, []int{1, 2}))
	require.NoError(t, ReplaceAgentChannels(agentB.Id, []int{2}))

	require.NoError(t, DB.Create(&User{
		Id: 201, Username: "u-a", Password: "x", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AffCode: "ua", AgentId: agentA.Id,
	}).Error)
	require.NoError(t, DB.Create(&User{
		Id: 202, Username: "u-b", Password: "x", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AffCode: "ub", AgentId: agentB.Id,
	}).Error)
	require.NoError(t, DB.Create(&User{
		Id: 203, Username: "platform", Password: "x", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AffCode: "pl", AgentId: 0,
	}).Error)

	// Agent A user on agent-a channel → counted
	require.NoError(t, DB.Create(&QuotaData{
		UserID: 201, Username: "u-a", ChannelID: 1, CreatedAt: 1000,
		Count: 2, Quota: 100, TokenUsed: 40,
	}).Error)
	// Agent A user on channel shared with B → counted for A
	require.NoError(t, DB.Create(&QuotaData{
		UserID: 201, Username: "u-a", ChannelID: 2, CreatedAt: 1000,
		Count: 1, Quota: 50, TokenUsed: 10,
	}).Error)
	// Agent B user on shared channel → counted for B only
	require.NoError(t, DB.Create(&QuotaData{
		UserID: 202, Username: "u-b", ChannelID: 2, CreatedAt: 1000,
		Count: 3, Quota: 300, TokenUsed: 90,
	}).Error)
	// Platform user on agent channel → excluded (not under agent)
	require.NoError(t, DB.Create(&QuotaData{
		UserID: 203, Username: "platform", ChannelID: 1, CreatedAt: 1000,
		Count: 9, Quota: 900, TokenUsed: 9,
	}).Error)
	// Agent A user on channel not in agent_channels → excluded
	require.NoError(t, DB.Create(&QuotaData{
		UserID: 201, Username: "u-a", ChannelID: 99, CreatedAt: 1000,
		Count: 5, Quota: 500, TokenUsed: 5,
	}).Error)
	// Outside time range
	require.NoError(t, DB.Create(&QuotaData{
		UserID: 201, Username: "u-a", ChannelID: 1, CreatedAt: 5000,
		Count: 1, Quota: 10, TokenUsed: 1,
	}).Error)

	rows, err := GetQuotaDataGroupByAgent(900, 2000)
	require.NoError(t, err)
	require.Len(t, rows, 2)

	byName := map[string]*AgentQuotaData{}
	for _, row := range rows {
		byName[row.AgentName] = row
	}
	require.Contains(t, byName, "agent-a")
	require.Contains(t, byName, "agent-b")
	assert.Equal(t, 150, byName["agent-a"].Quota)
	assert.Equal(t, 3, byName["agent-a"].Count)
	assert.Equal(t, 50, byName["agent-a"].TokenUsed)
	assert.Equal(t, 300, byName["agent-b"].Quota)
	assert.Equal(t, 3, byName["agent-b"].Count)
	assert.Equal(t, agentA.Id, byName["agent-a"].AgentId)
	assert.Equal(t, agentB.Id, byName["agent-b"].AgentId)
}
