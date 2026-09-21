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

func TestGetQuotaDataByAgentIdAggregatesRegisteredUsersOnly(t *testing.T) {
	newAgentTestDB(t)
	require.NoError(t, DB.AutoMigrate(&QuotaData{}))

	agent := &Agent{
		UserId: 301, Name: "agent", InviteCode: "agentdata", Status: AgentStatusEnabled,
	}
	require.NoError(t, CreateAgent(agent))
	require.NoError(t, DB.Create(&User{
		Id: 301, Username: "owner", Password: "x", Role: common.RoleAgentUser,
		Status: common.UserStatusEnabled, Group: "default", AffCode: "owner",
	}).Error)
	require.NoError(t, DB.Create(&User{
		Id: 302, Username: "member-a", Password: "x", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AffCode: "membera", AgentId: agent.Id,
	}).Error)
	require.NoError(t, DB.Create(&User{
		Id: 303, Username: "member-b", Password: "x", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AffCode: "memberb", AgentId: agent.Id,
	}).Error)
	require.NoError(t, DB.Create(&QuotaData{
		UserID: 301, Username: "owner", ModelName: "gpt-4", CreatedAt: 1000, Count: 9, Quota: 900, TokenUsed: 90,
	}).Error)
	require.NoError(t, DB.Create(&QuotaData{
		UserID: 302, Username: "member-a", ModelName: "gpt-4", CreatedAt: 1000, Count: 2, Quota: 100, TokenUsed: 40,
	}).Error)
	require.NoError(t, DB.Create(&QuotaData{
		UserID: 303, Username: "member-b", ModelName: "gpt-4", CreatedAt: 1000, Count: 3, Quota: 150, TokenUsed: 60,
	}).Error)
	require.NoError(t, DB.Create(&QuotaData{
		UserID: 302, Username: "member-a", ModelName: "claude-3", CreatedAt: 1000, Count: 1, Quota: 80, TokenUsed: 20,
	}).Error)

	rows, err := GetQuotaDataByAgentId(agent.Id, 900, 2000)
	require.NoError(t, err)
	require.Len(t, rows, 2)

	byModel := make(map[string]*QuotaData, len(rows))
	for _, row := range rows {
		byModel[row.ModelName] = row
	}
	assert.Equal(t, 250, byModel["gpt-4"].Quota)
	assert.Equal(t, 5, byModel["gpt-4"].Count)
	assert.Equal(t, 100, byModel["gpt-4"].TokenUsed)
	assert.Equal(t, 80, byModel["claude-3"].Quota)

	require.NoError(t, DB.Create(&User{
		Id: 304, Username: "invitee", Password: "x", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AffCode: "invitee",
		InviterId: 301, AgentId: 0,
	}).Error)
	require.NoError(t, DB.Create(&QuotaData{
		UserID: 304, Username: "invitee", ModelName: "glm-5.3", CreatedAt: 3600,
		Count: 4, Quota: 40, TokenUsed: 16, PromptTokens: 10, CompletionTokens: 6, CacheTokens: 3,
	}).Error)
	hourly, err := GetQuotaDataByAgentId(agent.Id, 3700, 8000)
	require.NoError(t, err)
	require.Len(t, hourly, 1)
	assert.Equal(t, "glm-5.3", hourly[0].ModelName)
	assert.Equal(t, 10, hourly[0].PromptTokens)
	assert.Equal(t, 6, hourly[0].CompletionTokens)
	assert.Equal(t, 3, hourly[0].CacheTokens)
}

func TestGetPlatformUsageSummaryAggregatesAllNonDeletedUsers(t *testing.T) {
	newAgentTestDB(t)

	users := []*User{
		{
			Id: 401, Username: "admin", Password: "x", Role: common.RoleAdminUser,
			Status: common.UserStatusEnabled, Group: "default", AffCode: "summary-admin",
			Quota: 1000, UsedQuota: 200, RequestCount: 3,
		},
		{
			Id: 402, Username: "agent", Password: "x", Role: common.RoleAgentUser,
			Status: common.UserStatusEnabled, Group: "default", AffCode: "summary-agent",
			Quota: 500, UsedQuota: 100, RequestCount: 2,
		},
		{
			Id: 403, Username: "user", Password: "x", Role: common.RoleCommonUser,
			Status: common.UserStatusEnabled, Group: "default", AffCode: "summary-user",
			Quota: 250, UsedQuota: 50, RequestCount: 1,
		},
	}
	require.NoError(t, DB.Create(users).Error)
	require.NoError(t, DB.Delete(users[2]).Error)

	summary, err := GetPlatformUsageSummary()
	require.NoError(t, err)

	assert.Equal(t, int64(1500), summary.Quota)
	assert.Equal(t, int64(300), summary.UsedQuota)
	assert.Equal(t, int64(5), summary.RequestCount)
}

func TestGetModelBillingLogsForAgentUsers(t *testing.T) {
	db := newAgentTestDB(t)
	require.NoError(t, db.AutoMigrate(&Log{}))
	previousLogDB := LOG_DB
	LOG_DB = db
	t.Cleanup(func() { LOG_DB = previousLogDB })

	agent := &Agent{
		UserId:     101,
		Name:       "billing-agent",
		InviteCode: "billingagent",
		Status:     AgentStatusEnabled,
	}
	require.NoError(t, CreateAgent(agent))
	require.NoError(t, DB.Create(&User{
		Id: 201, Username: "agent-user", Password: "x", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AffCode: "agentuser", AgentId: agent.Id,
	}).Error)
	require.NoError(t, DB.Create(&User{
		Id: 202, Username: "platform-user", Password: "x", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AffCode: "platformuser",
	}).Error)
	userOther := common.MapToJsonStr(map[string]any{
		"model_ratio": 1.0,
		"admin_info":  map[string]any{"use_channel": []int{1}},
	})
	require.NoError(t, LOG_DB.Create(&[]Log{
		{UserId: 201, Username: "agent-user", TokenName: "private-token", Ip: "192.0.2.1", Type: LogTypeConsume, ModelName: "glm-5.3", CreatedAt: 1000, Quota: 10, Other: userOther},
		{UserId: 201, Username: "agent-user", Type: LogTypeConsume, ModelName: "other", CreatedAt: 1000, Quota: 20, Other: userOther},
		{UserId: 202, Username: "platform-user", Type: LogTypeConsume, ModelName: "glm-5.3", CreatedAt: 1000, Quota: 30, Other: userOther},
	}).Error)

	userIDs, err := ListUserIDsByAgentID(agent.Id)
	require.NoError(t, err)
	logs, total, err := GetAgentModelBillingLogs(userIDs, 900, 1100, "glm-5.3", 0, 20)
	require.NoError(t, err)
	require.Len(t, logs, 1)
	assert.Equal(t, int64(1), total)
	assert.Equal(t, 201, logs[0].UserId)
	assert.Empty(t, logs[0].TokenName)
	assert.Empty(t, logs[0].Ip)

	other, err := common.StrToMap(logs[0].Other)
	require.NoError(t, err)
	assert.Contains(t, other, "model_ratio")
	assert.NotContains(t, other, "admin_info")

	require.NoError(t, LOG_DB.Create(&Log{
		UserId: 201, Username: "agent-user", Type: LogTypeConsume, ModelName: "glm-5.3", CreatedAt: 3650, Quota: 7,
	}).Error)
	hourly, hourlyTotal, err := GetAgentModelBillingLogs(userIDs, 3700, 4000, "glm-5.3", 0, 20)
	require.NoError(t, err)
	require.Len(t, hourly, 1)
	assert.Equal(t, int64(1), hourlyTotal)
	assert.Equal(t, int64(3650), hourly[0].CreatedAt)
}

func TestGetAgentSettlementUsageSumsCurrentChannelUsersAndCost(t *testing.T) {
	db := newAgentTestDB(t)
	require.NoError(t, db.AutoMigrate(&Log{}))
	previousLogDB := LOG_DB
	LOG_DB = db
	t.Cleanup(func() { LOG_DB = previousLogDB })

	agent := &Agent{
		UserId:     501,
		Name:       "settle-agent",
		InviteCode: "settleagent",
		Status:     AgentStatusEnabled,
	}
	require.NoError(t, CreateAgent(agent))
	require.NoError(t, ReplaceAgentChannels(agent.Id, []int{11, 12}))
	require.NoError(t, DB.Create(&User{
		Id: 601, Username: "settle-user", Password: "x", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AffCode: "settleuser", AgentId: agent.Id,
	}).Error)
	require.NoError(t, DB.Create(&User{
		Id: 602, Username: "other-user", Password: "x", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AffCode: "otheruser",
	}).Error)

	userOther := common.MapToJsonStr(map[string]any{
		"admin_info": map[string]any{"platform_quota": 4},
	})
	costOther := common.MapToJsonStr(map[string]any{
		"admin_info": map[string]any{"platform_quota": 9},
	})
	require.NoError(t, LOG_DB.Create(&[]Log{
		{UserId: 601, Username: "settle-user", Type: LogTypeConsume, ChannelId: 11, CreatedAt: 1000, Quota: 20, PromptTokens: 8, CompletionTokens: 2, Other: userOther},
		{UserId: 601, Username: "settle-user", Type: LogTypeConsume, ChannelId: 12, CreatedAt: 1100, Quota: 10, PromptTokens: 3, CompletionTokens: 1, Other: costOther},
		{UserId: 601, Username: "settle-user", Type: LogTypeConsume, ChannelId: 99, CreatedAt: 1000, Quota: 50, PromptTokens: 9, CompletionTokens: 9, Other: costOther},
		{UserId: 602, Username: "other-user", Type: LogTypeConsume, ChannelId: 11, CreatedAt: 1000, Quota: 80, PromptTokens: 7, CompletionTokens: 7, Other: costOther},
		{UserId: 601, Username: "settle-user", Type: LogTypeConsume, ChannelId: 11, CreatedAt: 5000, Quota: 15, PromptTokens: 1, CompletionTokens: 1, Other: userOther},
	}).Error)

	usage, err := GetAgentSettlementUsage(agent.Id, 900, 2000)
	require.NoError(t, err)
	require.Len(t, usage.Users, 1)
	assert.Equal(t, 601, usage.Users[0].UserId)
	assert.Equal(t, "settle-user", usage.Users[0].Username)
	assert.Equal(t, 2, usage.Users[0].Count)
	assert.Equal(t, int64(30), usage.Users[0].Quota)
	assert.Equal(t, int64(13), usage.Users[0].PlatformQuota)
	assert.Equal(t, int64(14), usage.Users[0].TokenUsed)
	assert.Equal(t, int64(2), usage.Count)
	assert.Equal(t, int64(30), usage.Quota)
	assert.Equal(t, int64(13), usage.PlatformQuota)
	assert.Equal(t, int64(14), usage.TokenUsed)
}

func TestSumConsumeLogUsageIncludesCacheTokensFromOther(t *testing.T) {
	db := newAgentTestDB(t)
	require.NoError(t, db.AutoMigrate(&Log{}))
	previousLogDB := LOG_DB
	LOG_DB = db
	t.Cleanup(func() { LOG_DB = previousLogDB })

	require.NoError(t, LOG_DB.Create(&[]Log{
		{
			UserId: 1, Username: "admin", Type: LogTypeConsume, ModelName: "kimi-k3",
			CreatedAt: 1000, Quota: 10, PromptTokens: 80, CompletionTokens: 20,
			Other: common.MapToJsonStr(map[string]any{"cache_tokens": 15}),
		},
		{
			UserId: 1, Username: "admin", Type: LogTypeConsume, ModelName: "kimi-k3",
			CreatedAt: 1100, Quota: 5, PromptTokens: 40, CompletionTokens: 10,
			Other: common.MapToJsonStr(map[string]any{"cache_tokens": 8}),
		},
		{
			UserId: 2, Username: "other", Type: LogTypeConsume, ModelName: "glm-5.3",
			CreatedAt: 1000, Quota: 9, PromptTokens: 7, CompletionTokens: 3,
			Other: common.MapToJsonStr(map[string]any{"cache_tokens": 2}),
		},
	}).Error)

	totals, err := SumConsumeLogUsage(ConsumeLogUsageQuery{
		StartTimestamp: 900,
		EndTimestamp:   2000,
		ModelName:      "kimi-k3",
	})
	require.NoError(t, err)
	require.Len(t, totals, 1)
	assert.Equal(t, int64(120), totals[0].PromptTokens)
	assert.Equal(t, int64(30), totals[0].CompletionTokens)
	assert.Equal(t, int64(23), totals[0].CacheTokens)
	assert.Equal(t, int64(15), totals[0].Quota)
	assert.Equal(t, int64(2), totals[0].Count)

	byModel, err := SumConsumeLogUsage(ConsumeLogUsageQuery{
		StartTimestamp: 900,
		EndTimestamp:   2000,
		ByModel:        true,
	})
	require.NoError(t, err)
	require.Len(t, byModel, 2)
	assert.Equal(t, "kimi-k3", byModel[0].ModelName)
	assert.Equal(t, int64(23), byModel[0].CacheTokens)
}
