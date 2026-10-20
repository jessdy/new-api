package model

import (
	"cmp"
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

type SettlementModelStat struct {
	ModelName        string  `json:"model_name"`
	Count            int     `json:"count"`
	PromptTokens     int64   `json:"prompt_tokens"`
	CompletionTokens int64   `json:"completion_tokens"`
	CacheTokens      int64   `json:"cache_tokens"`
	UnitPrice        float64 `json:"unit_price"`
	Quota            int64   `json:"quota"`
	PlatformQuota    int64   `json:"platform_quota"`
}

type AgentSettlementUsageUser struct {
	UserId           int                   `json:"user_id"`
	Username         string                `json:"username"`
	Count            int                   `json:"count"`
	Quota            int64                 `json:"quota"`
	PlatformQuota    int64                 `json:"platform_quota"`
	TokenUsed        int64                 `json:"token_used"`
	PromptTokens     int64                 `json:"prompt_tokens"`
	CompletionTokens int64                 `json:"completion_tokens"`
	CacheTokens      int64                 `json:"cache_tokens"`
	Models           []SettlementModelStat `json:"models"`
}

type AgentSettlementUsage struct {
	Users            []AgentSettlementUsageUser `json:"users"`
	Models           []SettlementModelStat      `json:"models"`
	Count            int64                      `json:"count"`
	Quota            int64                      `json:"quota"`
	PlatformQuota    int64                      `json:"platform_quota"`
	TokenUsed        int64                      `json:"token_used"`
	PromptTokens     int64                      `json:"prompt_tokens"`
	CompletionTokens int64                      `json:"completion_tokens"`
	CacheTokens      int64                      `json:"cache_tokens"`
}

type ChannelPendingSettlementChannel struct {
	ChannelId        int                   `json:"channel_id"`
	ChannelName      string                `json:"channel_name"`
	Count            int                   `json:"count"`
	Quota            int64                 `json:"quota"`
	PlatformQuota    int64                 `json:"platform_quota"`
	PromptTokens     int64                 `json:"prompt_tokens"`
	CompletionTokens int64                 `json:"completion_tokens"`
	CacheTokens      int64                 `json:"cache_tokens"`
	Models           []SettlementModelStat `json:"models"`
}

type ChannelPendingSettlement struct {
	Channels         []ChannelPendingSettlementChannel `json:"channels"`
	Models           []SettlementModelStat             `json:"models"`
	Count            int64                             `json:"count"`
	Quota            int64                             `json:"quota"`
	PlatformQuota    int64                             `json:"platform_quota"`
	PromptTokens     int64                             `json:"prompt_tokens"`
	CompletionTokens int64                             `json:"completion_tokens"`
	CacheTokens      int64                             `json:"cache_tokens"`
}

type settlementModelAccum struct {
	stat        SettlementModelStat
	priceSum    float64
	priceWeight float64
}

type consumeLogSettlementRow struct {
	UserId           int
	Username         string
	ChannelId        int
	ModelName        string
	Quota            int
	PromptTokens     int
	CompletionTokens int
	Other            string
}

func GetAgentSettlementUsage(agentId int, startTimestamp int64, endTimestamp int64) (AgentSettlementUsage, error) {
	usage := AgentSettlementUsage{
		Users:  []AgentSettlementUsageUser{},
		Models: []SettlementModelStat{},
	}
	if agentId <= 0 {
		return usage, nil
	}
	userIDs, err := ListUserIDsByAgentID(agentId)
	if err != nil {
		return usage, err
	}
	channelIDs, err := ListAgentChannelIds(agentId)
	if err != nil {
		return usage, err
	}
	if len(userIDs) == 0 || len(channelIDs) == 0 {
		return usage, nil
	}

	tx := LOG_DB.Model(&Log{}).
		Select("user_id, username, model_name, quota, prompt_tokens, completion_tokens, other").
		Where("user_id IN ? AND type = ? AND channel_id IN ?", userIDs, LogTypeConsume, channelIDs)
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}

	var rows []consumeLogSettlementRow
	if err := tx.Find(&rows).Error; err != nil {
		return usage, err
	}

	type userAccum struct {
		user    AgentSettlementUsageUser
		byModel map[string]*settlementModelAccum
	}
	byUser := make(map[int]*userAccum, len(rows))
	overallModels := make(map[string]*settlementModelAccum)
	for _, row := range rows {
		item := byUser[row.UserId]
		if item == nil {
			item = &userAccum{
				user:    AgentSettlementUsageUser{UserId: row.UserId, Username: row.Username},
				byModel: make(map[string]*settlementModelAccum),
			}
			byUser[row.UserId] = item
		}
		if item.user.Username == "" && row.Username != "" {
			item.user.Username = row.Username
		}
		prompt := int64(row.PromptTokens)
		completion := int64(row.CompletionTokens)
		quota := int64(row.Quota)
		platformQuota, cacheTokens, modelPrice := consumeLogExtrasFromOther(row.Other)
		item.user.Count++
		item.user.Quota += quota
		item.user.PlatformQuota += platformQuota
		item.user.PromptTokens += prompt
		item.user.CompletionTokens += completion
		item.user.CacheTokens += cacheTokens
		item.user.TokenUsed += prompt + completion
		addSettlementModel(item.byModel, row.ModelName, prompt, completion, cacheTokens, quota, platformQuota, modelPrice)
		addSettlementModel(overallModels, row.ModelName, prompt, completion, cacheTokens, quota, platformQuota, modelPrice)
	}

	users := make([]AgentSettlementUsageUser, 0, len(byUser))
	for _, item := range byUser {
		item.user.Models = finishSettlementModels(item.byModel)
		users = append(users, item.user)
		usage.Count += int64(item.user.Count)
		usage.Quota += item.user.Quota
		usage.PlatformQuota += item.user.PlatformQuota
		usage.TokenUsed += item.user.TokenUsed
		usage.PromptTokens += item.user.PromptTokens
		usage.CompletionTokens += item.user.CompletionTokens
		usage.CacheTokens += item.user.CacheTokens
	}
	slices.SortFunc(users, func(a, b AgentSettlementUsageUser) int {
		if c := cmp.Compare(b.Quota, a.Quota); c != 0 {
			return c
		}
		return cmp.Compare(a.UserId, b.UserId)
	})
	usage.Users = users
	usage.Models = finishSettlementModels(overallModels)
	return usage, nil
}

func GetChannelPendingSettlement(startTimestamp int64, endTimestamp int64) (ChannelPendingSettlement, error) {
	usage := ChannelPendingSettlement{
		Channels: []ChannelPendingSettlementChannel{},
		Models:   []SettlementModelStat{},
	}
	tx := LOG_DB.Model(&Log{}).
		Select("channel_id, model_name, quota, prompt_tokens, completion_tokens, other").
		Where("type = ?", LogTypeConsume)
	if startTimestamp != 0 {
		tx = tx.Where("created_at >= ?", startTimestamp)
	}
	if endTimestamp != 0 {
		tx = tx.Where("created_at <= ?", endTimestamp)
	}

	var rows []consumeLogSettlementRow
	if err := tx.Find(&rows).Error; err != nil {
		return usage, err
	}

	type channelAccum struct {
		channel ChannelPendingSettlementChannel
		byModel map[string]*settlementModelAccum
	}
	byChannel := make(map[int]*channelAccum)
	overallModels := make(map[string]*settlementModelAccum)
	channelIDs := make([]int, 0)
	for _, row := range rows {
		item := byChannel[row.ChannelId]
		if item == nil {
			item = &channelAccum{
				channel: ChannelPendingSettlementChannel{ChannelId: row.ChannelId},
				byModel: make(map[string]*settlementModelAccum),
			}
			byChannel[row.ChannelId] = item
			channelIDs = append(channelIDs, row.ChannelId)
		}
		prompt := int64(row.PromptTokens)
		completion := int64(row.CompletionTokens)
		quota := int64(row.Quota)
		platformQuota, cacheTokens, modelPrice := consumeLogExtrasFromOther(row.Other)
		item.channel.Count++
		item.channel.Quota += quota
		item.channel.PlatformQuota += platformQuota
		item.channel.PromptTokens += prompt
		item.channel.CompletionTokens += completion
		item.channel.CacheTokens += cacheTokens
		addSettlementModel(item.byModel, row.ModelName, prompt, completion, cacheTokens, quota, platformQuota, modelPrice)
		addSettlementModel(overallModels, row.ModelName, prompt, completion, cacheTokens, quota, platformQuota, modelPrice)
	}

	names := make(map[int]string, len(channelIDs))
	if len(channelIDs) > 0 {
		var named []struct {
			Id   int
			Name string
		}
		if err := DB.Model(&Channel{}).Select("id, name").Where("id IN ?", channelIDs).Find(&named).Error; err != nil {
			return usage, err
		}
		for _, row := range named {
			names[row.Id] = row.Name
		}
	}

	channels := make([]ChannelPendingSettlementChannel, 0, len(byChannel))
	for _, item := range byChannel {
		item.channel.ChannelName = names[item.channel.ChannelId]
		item.channel.Models = finishSettlementModels(item.byModel)
		channels = append(channels, item.channel)
		usage.Count += int64(item.channel.Count)
		usage.Quota += item.channel.Quota
		usage.PlatformQuota += item.channel.PlatformQuota
		usage.PromptTokens += item.channel.PromptTokens
		usage.CompletionTokens += item.channel.CompletionTokens
		usage.CacheTokens += item.channel.CacheTokens
	}
	slices.SortFunc(channels, func(a, b ChannelPendingSettlementChannel) int {
		pendingA := a.PlatformQuota
		if pendingA == 0 {
			pendingA = a.Quota
		}
		pendingB := b.PlatformQuota
		if pendingB == 0 {
			pendingB = b.Quota
		}
		if c := cmp.Compare(pendingB, pendingA); c != 0 {
			return c
		}
		return cmp.Compare(a.ChannelId, b.ChannelId)
	})
	usage.Channels = channels
	usage.Models = finishSettlementModels(overallModels)
	return usage, nil
}

func addSettlementModel(byModel map[string]*settlementModelAccum, modelName string, prompt, completion, cache, quota, platformQuota int64, price float64) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		modelName = "—"
	}
	item := byModel[modelName]
	if item == nil {
		item = &settlementModelAccum{stat: SettlementModelStat{ModelName: modelName}}
		byModel[modelName] = item
	}
	item.stat.Count++
	item.stat.PromptTokens += prompt
	item.stat.CompletionTokens += completion
	item.stat.CacheTokens += cache
	item.stat.Quota += quota
	item.stat.PlatformQuota += platformQuota
	weight := float64(prompt + completion + cache)
	if weight <= 0 {
		weight = 1
	}
	if price > 0 {
		item.priceSum += price * weight
		item.priceWeight += weight
	}
}

func finishSettlementModels(byModel map[string]*settlementModelAccum) []SettlementModelStat {
	models := make([]SettlementModelStat, 0, len(byModel))
	for _, item := range byModel {
		if item.priceWeight > 0 {
			item.stat.UnitPrice = item.priceSum / item.priceWeight
		}
		models = append(models, item.stat)
	}
	slices.SortFunc(models, func(a, b SettlementModelStat) int {
		if c := cmp.Compare(b.Quota, a.Quota); c != 0 {
			return c
		}
		if c := cmp.Compare(b.PlatformQuota, a.PlatformQuota); c != 0 {
			return c
		}
		return cmp.Compare(a.ModelName, b.ModelName)
	})
	return models
}

func consumeLogExtrasFromOther(other string) (platformQuota int64, cacheTokens int64, modelPrice float64) {
	if strings.TrimSpace(other) == "" {
		return 0, 0, 0
	}
	values, err := common.StrToMap(other)
	if err != nil || values == nil {
		return 0, 0, 0
	}
	if admin, ok := values["admin_info"].(map[string]any); ok && admin != nil {
		platformQuota = int64FromAny(admin["platform_quota"])
	}
	cacheTokens = int64FromAny(values["cache_tokens"])
	modelPrice = floatFromAny(values["model_price"])
	return platformQuota, cacheTokens, modelPrice
}

func int64FromAny(value any) int64 {
	switch typed := value.(type) {
	case float64:
		return int64(typed)
	case float32:
		return int64(typed)
	case int:
		return int64(typed)
	case int64:
		return typed
	default:
		return 0
	}
}

func floatFromAny(value any) float64 {
	switch typed := value.(type) {
	case float64:
		return typed
	case float32:
		return float64(typed)
	case int:
		return float64(typed)
	case int64:
		return float64(typed)
	default:
		return 0
	}
}
