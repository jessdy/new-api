package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func GetAllLogs(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	username := c.Query("username")
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	requestId := c.Query("request_id")
	upstreamRequestId := c.Query("upstream_request_id")
	logs, total, err := model.GetAllLogs(logType, startTimestamp, endTimestamp, modelName, username, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), channel, group, requestId, upstreamRequestId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if c.GetInt("role") < common.RoleRootUser {
		model.FormatAdminLogs(logs)
	} else {
		model.FormatRootLogs(logs)
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
	return
}

func GetUserLogs(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	userId := c.GetInt("id")
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	group := c.Query("group")
	requestId := c.Query("request_id")
	upstreamRequestId := c.Query("upstream_request_id")
	logs, total, err := model.GetUserLogs(userId, logType, startTimestamp, endTimestamp, modelName, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), group, requestId, upstreamRequestId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
	return
}

func GetAgentModelBillingLogs(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	agentId := c.GetInt("agent_id")
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	modelName := c.Query("model_name")
	userIDs, err := model.ListUserIDsByAgentID(agentId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	logs, total, err := model.GetAgentModelBillingLogs(
		userIDs,
		startTimestamp,
		endTimestamp,
		modelName,
		pageInfo.GetStartIdx(),
		pageInfo.GetPageSize(),
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
}

// Deprecated: SearchAllLogs 已废弃，前端未使用该接口。
func SearchAllLogs(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"message": "该接口已废弃",
	})
}

// Deprecated: SearchUserLogs 已废弃，前端未使用该接口。
func SearchUserLogs(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"message": "该接口已废弃",
	})
}

func GetLogByKey(c *gin.Context) {
	tokenId := c.GetInt("token_id")
	if tokenId == 0 {
		c.JSON(200, gin.H{
			"success": false,
			"message": "无效的令牌",
		})
		return
	}
	logs, err := model.GetLogByTokenId(tokenId)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"message": "",
		"data":    logs,
	})
}

func GetLogsStat(c *gin.Context) {
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	username := c.Query("username")
	modelName := c.Query("model_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	if c.Query("by_model") == "1" || c.Query("by_model") == "true" {
		usages, err := model.SumConsumeLogUsage(model.ConsumeLogUsageQuery{
			StartTimestamp: startTimestamp,
			EndTimestamp:   endTimestamp,
			ModelName:      modelName,
			Username:       username,
			ByModel:        true,
		})
		if err != nil {
			common.ApiError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data":    usages,
		})
		return
	}
	stat, err := model.SumUsedQuota(logType, startTimestamp, endTimestamp, modelName, username, tokenName, channel, group)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	usages, err := model.SumConsumeLogUsage(model.ConsumeLogUsageQuery{
		StartTimestamp: startTimestamp,
		EndTimestamp:   endTimestamp,
		ModelName:      modelName,
		Username:       username,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	usage := model.ConsumeLogUsage{}
	if len(usages) > 0 {
		usage = usages[0]
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"quota":             stat.Quota,
			"rpm":               stat.Rpm,
			"tpm":               stat.Tpm,
			"prompt_tokens":     usage.PromptTokens,
			"completion_tokens": usage.CompletionTokens,
			"cache_tokens":      usage.CacheTokens,
		},
	})
}

func GetLogsSelfStat(c *gin.Context) {
	username := c.GetString("username")
	userId := c.GetInt("id")
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	if c.Query("by_model") == "1" || c.Query("by_model") == "true" {
		usages, err := model.SumConsumeLogUsage(model.ConsumeLogUsageQuery{
			StartTimestamp: startTimestamp,
			EndTimestamp:   endTimestamp,
			ModelName:      modelName,
			UserID:         userId,
			ByModel:        true,
		})
		if err != nil {
			common.ApiError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data":    usages,
		})
		return
	}
	quotaNum, err := model.SumUsedQuota(logType, startTimestamp, endTimestamp, modelName, username, tokenName, channel, group)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	usages, err := model.SumConsumeLogUsage(model.ConsumeLogUsageQuery{
		StartTimestamp: startTimestamp,
		EndTimestamp:   endTimestamp,
		ModelName:      modelName,
		UserID:         userId,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	usage := model.ConsumeLogUsage{}
	if len(usages) > 0 {
		usage = usages[0]
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"quota":             quotaNum.Quota,
			"rpm":               quotaNum.Rpm,
			"tpm":               quotaNum.Tpm,
			"prompt_tokens":     usage.PromptTokens,
			"completion_tokens": usage.CompletionTokens,
			"cache_tokens":      usage.CacheTokens,
		},
	})
}

func GetAgentModelBillingStat(c *gin.Context) {
	agentId := c.GetInt("agent_id")
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	modelName := c.Query("model_name")
	userIDs, err := model.ListUserIDsByAgentID(agentId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if startTimestamp > 0 {
		startTimestamp -= startTimestamp % 3600
	}
	usages, err := model.SumConsumeLogUsage(model.ConsumeLogUsageQuery{
		StartTimestamp: startTimestamp,
		EndTimestamp:   endTimestamp,
		ModelName:      modelName,
		UserIDs:        userIDs,
		ByModel:        c.Query("by_model") == "1" || c.Query("by_model") == "true" || modelName == "",
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if modelName != "" && c.Query("by_model") != "1" && c.Query("by_model") != "true" {
		usage := model.ConsumeLogUsage{ModelName: modelName}
		if len(usages) > 0 {
			usage = usages[0]
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data": gin.H{
				"quota":             usage.Quota,
				"prompt_tokens":     usage.PromptTokens,
				"completion_tokens": usage.CompletionTokens,
				"cache_tokens":      usage.CacheTokens,
			},
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    usages,
	})
}
