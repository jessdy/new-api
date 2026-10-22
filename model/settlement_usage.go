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
	InputUnitPrice   float64 `json:"input_unit_price"`
	OutputUnitPrice  float64 `json:"output_unit_price"`
	CacheUnitPrice   float64 `json:"cache_unit_price"`
	PerCall          bool    `json:"per_call"`
	Quota            int64   `json:"quota"`
	PlatformQuota    int64   `json:"platform_quota"`
	ChannelQuota     int64   `json:"channel_quota"`
}

type AgentSettlementUsageUser struct {
	UserId           int                   `json:"user_id"`
	Username         string                `json:"username"`
	Count            int                   `json:"count"`
	Quota            int64                 `json:"quota"`
	PlatformQuota    int64                 `json:"platform_quota"`
	ChannelQuota     int64                 `json:"channel_quota"`
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
	ChannelQuota     int64                      `json:"channel_quota"`
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
	ChannelQuota     int64                 `json:"channel_quota"`
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
	ChannelQuota     int64                             `json:"channel_quota"`
	PromptTokens     int64                             `json:"prompt_tokens"`
	CompletionTokens int64                             `json:"completion_tokens"`
	CacheTokens      int64                             `json:"cache_tokens"`
}

type settlementModelAccum struct {
	stat         SettlementModelStat
	inputSum     float64
	inputWeight  float64
	outputSum    float64
	outputWeight float64
	cacheSum     float64
	cacheWeight  float64
	callSum      float64
	callWeight   float64
}

type settlementLogFact struct {
	platformQuota int64
	channelQuota  int64
	inputTokens   int64
	outputTokens  int64
	cacheTokens   int64
	perCall       bool
	inputPrice    float64
	outputPrice   float64
	cachePrice    float64
	callPrice     float64
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
		quota := int64(row.Quota)
		fact := settlementFactFromLog(row.PromptTokens, row.CompletionTokens, row.Other)
		item.user.Count++
		item.user.Quota += quota
		item.user.PlatformQuota += fact.platformQuota
		item.user.ChannelQuota += fact.channelQuota
		item.user.PromptTokens += fact.inputTokens
		item.user.CompletionTokens += fact.outputTokens
		item.user.CacheTokens += fact.cacheTokens
		item.user.TokenUsed += fact.inputTokens + fact.outputTokens + fact.cacheTokens
		addSettlementModel(item.byModel, row.ModelName, quota, fact)
		addSettlementModel(overallModels, row.ModelName, quota, fact)
	}

	users := make([]AgentSettlementUsageUser, 0, len(byUser))
	for _, item := range byUser {
		item.user.Models = finishSettlementModels(item.byModel)
		users = append(users, item.user)
		usage.Count += int64(item.user.Count)
		usage.Quota += item.user.Quota
		usage.PlatformQuota += item.user.PlatformQuota
		usage.ChannelQuota += item.user.ChannelQuota
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
		quota := int64(row.Quota)
		fact := settlementFactFromLog(row.PromptTokens, row.CompletionTokens, row.Other)
		item.channel.Count++
		item.channel.Quota += quota
		item.channel.PlatformQuota += fact.platformQuota
		item.channel.ChannelQuota += fact.channelQuota
		item.channel.PromptTokens += fact.inputTokens
		item.channel.CompletionTokens += fact.outputTokens
		item.channel.CacheTokens += fact.cacheTokens
		addSettlementModel(item.byModel, row.ModelName, quota, fact)
		addSettlementModel(overallModels, row.ModelName, quota, fact)
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
		usage.ChannelQuota += item.channel.ChannelQuota
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

func addSettlementModel(byModel map[string]*settlementModelAccum, modelName string, quota int64, fact settlementLogFact) {
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
	item.stat.PromptTokens += fact.inputTokens
	item.stat.CompletionTokens += fact.outputTokens
	item.stat.CacheTokens += fact.cacheTokens
	item.stat.Quota += quota
	item.stat.PlatformQuota += fact.platformQuota
	item.stat.ChannelQuota += fact.channelQuota
	if fact.perCall {
		if fact.callPrice > 0 {
			item.callSum += fact.callPrice
			item.callWeight++
		}
		return
	}
	if fact.inputTokens > 0 && fact.inputPrice > 0 {
		item.inputSum += fact.inputPrice * float64(fact.inputTokens)
		item.inputWeight += float64(fact.inputTokens)
	}
	if fact.outputTokens > 0 && fact.outputPrice > 0 {
		item.outputSum += fact.outputPrice * float64(fact.outputTokens)
		item.outputWeight += float64(fact.outputTokens)
	}
	if fact.cacheTokens > 0 && fact.cachePrice > 0 {
		item.cacheSum += fact.cachePrice * float64(fact.cacheTokens)
		item.cacheWeight += float64(fact.cacheTokens)
	}
}

func finishSettlementModels(byModel map[string]*settlementModelAccum) []SettlementModelStat {
	models := make([]SettlementModelStat, 0, len(byModel))
	for _, item := range byModel {
		if item.inputWeight > 0 {
			item.stat.InputUnitPrice = item.inputSum / item.inputWeight
		}
		if item.outputWeight > 0 {
			item.stat.OutputUnitPrice = item.outputSum / item.outputWeight
		}
		if item.cacheWeight > 0 {
			item.stat.CacheUnitPrice = item.cacheSum / item.cacheWeight
		}
		if item.callWeight > 0 && item.inputWeight == 0 && item.outputWeight == 0 && item.cacheWeight == 0 {
			item.stat.PerCall = true
			item.stat.UnitPrice = item.callSum / item.callWeight
		} else {
			item.stat.UnitPrice = item.stat.InputUnitPrice
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

func settlementFactFromLog(promptTokens int, completionTokens int, other string) settlementLogFact {
	fact := settlementLogFact{outputTokens: int64(completionTokens)}
	if strings.TrimSpace(other) == "" {
		fact.inputTokens = int64(promptTokens)
		return fact
	}
	values, err := common.StrToMap(other)
	if err != nil || values == nil {
		fact.inputTokens = int64(promptTokens)
		return fact
	}
	if admin, ok := values["admin_info"].(map[string]any); ok && admin != nil {
		fact.platformQuota = int64FromAny(admin["platform_quota"])
		fact.channelQuota = int64FromAny(admin["channel_quota"])
	}
	cacheRead := int64FromAny(values["cache_tokens"])
	cacheWrite := cacheWriteTokensFromOther(values)
	fact.cacheTokens = cacheRead + cacheWrite
	fact.inputTokens = int64(promptTokens)
	claude, _ := values["claude"].(bool)
	if !claude {
		deducted := cacheRead + cacheWrite
		if deducted > 0 && fact.inputTokens >= deducted {
			fact.inputTokens -= deducted
		}
	}
	group := settlementGroupRatio(values)
	modelPrice := floatFromAny(values["model_price"])
	if modelPrice > 0 {
		fact.perCall = true
		fact.callPrice = modelPrice * group
		return fact
	}
	modelRatio := floatFromAny(values["model_ratio"])
	if modelRatio <= 0 {
		return fact
	}
	completionRatio := 1.0
	if ratio, ok := optionalFloat(values["completion_ratio"]); ok {
		completionRatio = ratio
	}
	inputPrice := modelRatio * 2 * group
	fact.inputPrice = inputPrice
	fact.outputPrice = inputPrice * completionRatio
	fact.cachePrice = blendedCacheUnitPrice(values, inputPrice, cacheRead, cacheWrite)
	return fact
}

func settlementGroupRatio(values map[string]any) float64 {
	if ratio, ok := optionalFloat(values["user_group_ratio"]); ok && ratio != -1 && ratio > 0 {
		return ratio
	}
	if ratio, ok := optionalFloat(values["group_ratio"]); ok && ratio > 0 {
		return ratio
	}
	return 1
}

func cacheWriteTokensFromOther(values map[string]any) int64 {
	creation := int64FromAny(values["cache_creation_tokens"])
	five := int64FromAny(values["cache_creation_tokens_5m"])
	hour := int64FromAny(values["cache_creation_tokens_1h"])
	if five > 0 || hour > 0 {
		split := five + hour
		if creation > split {
			return creation
		}
		return split
	}
	return creation
}

func blendedCacheUnitPrice(values map[string]any, inputPrice float64, cacheRead int64, cacheWrite int64) float64 {
	total := cacheRead + cacheWrite
	if total <= 0 || inputPrice <= 0 {
		return 0
	}
	cacheRatio := 1.0
	if ratio, ok := optionalFloat(values["cache_ratio"]); ok {
		cacheRatio = ratio
	}
	readPrice := inputPrice * cacheRatio
	if cacheWrite <= 0 {
		return readPrice
	}
	creationRatio := 1.0
	if ratio, ok := optionalFloat(values["cache_creation_ratio"]); ok {
		creationRatio = ratio
	}
	five := int64FromAny(values["cache_creation_tokens_5m"])
	hour := int64FromAny(values["cache_creation_tokens_1h"])
	writePrice := inputPrice * creationRatio
	if five > 0 || hour > 0 {
		fiveRatio := creationRatio
		if ratio, ok := optionalFloat(values["cache_creation_ratio_5m"]); ok {
			fiveRatio = ratio
		}
		hourRatio := creationRatio
		if ratio, ok := optionalFloat(values["cache_creation_ratio_1h"]); ok {
			hourRatio = ratio
		}
		creation := int64FromAny(values["cache_creation_tokens"])
		remaining := creation - five - hour
		if remaining < 0 {
			remaining = 0
		}
		weighted := float64(remaining)*creationRatio + float64(five)*fiveRatio + float64(hour)*hourRatio
		if cacheWrite > 0 {
			writePrice = inputPrice * weighted / float64(cacheWrite)
		}
	}
	return (readPrice*float64(cacheRead) + writePrice*float64(cacheWrite)) / float64(total)
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
	parsed, _ := optionalFloat(value)
	return parsed
}

func optionalFloat(value any) (float64, bool) {
	switch typed := value.(type) {
	case float64:
		return typed, true
	case float32:
		return float64(typed), true
	case int:
		return float64(typed), true
	case int64:
		return float64(typed), true
	default:
		return 0, false
	}
}
