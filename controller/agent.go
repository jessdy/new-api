package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func AgentGetSelf(c *gin.Context) {
	agent, ok := middleware.GetCurrentAgent(c)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "agent not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": model.AgentPublicSummary(agent)})
}

func AgentListSelectableChannels(c *gin.Context) {
	agent, ok := middleware.GetCurrentAgent(c)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "agent not found"})
		return
	}
	selected, err := model.ListAgentChannelIds(agent.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	selectedSet := make(map[int]struct{}, len(selected))
	for _, id := range selected {
		selectedSet[id] = struct{}{}
	}
	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]map[string]any, 0, len(channels))
	for _, ch := range channels {
		if ch == nil || ch.Status != common.ChannelStatusEnabled {
			continue
		}
		_, isSelected := selectedSet[ch.Id]
		items = append(items, map[string]any{
			"id":       ch.Id,
			"name":     ch.Name,
			"type":     ch.Type,
			"models":   ch.GetModels(),
			"group":    ch.Group,
			"status":   ch.Status,
			"priority": ch.GetPriority(),
			"weight":   ch.GetWeight(),
			"selected": isSelected,
		})
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": items})
}

type replaceAgentChannelsRequest struct {
	ChannelIds []int `json:"channel_ids"`
}

func AgentReplaceChannels(c *gin.Context) {
	agent, ok := middleware.GetCurrentAgent(c)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "agent not found"})
		return
	}
	var req replaceAgentChannelsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	for _, id := range req.ChannelIds {
		ch, err := model.GetChannelById(id, false)
		if err != nil || ch == nil {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid channel id"})
			return
		}
	}
	if err := model.ReplaceAgentChannels(agent.Id, req.ChannelIds); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

func AgentListGroups(c *gin.Context) {
	agent, ok := middleware.GetCurrentAgent(c)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "agent not found"})
		return
	}
	view, err := model.GetAgentGroupPricingView(agent.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": view})
}

func AgentUpsertGroup(c *gin.Context) {
	agent, ok := middleware.GetCurrentAgent(c)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "agent not found"})
		return
	}
	var view model.AgentGroupPricingView
	if err := common.DecodeJson(c.Request.Body, &view); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.ReplaceAgentGroupPricing(agent.Id, view); err != nil {
		common.ApiError(c, err)
		return
	}
	saved, err := model.GetAgentGroupPricingView(agent.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": saved})
}

func AgentDeleteGroup(c *gin.Context) {
	agent, ok := middleware.GetCurrentAgent(c)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "agent not found"})
		return
	}
	name := strings.TrimSpace(c.Param("name"))
	if err := model.DeleteAgentGroup(agent.Id, name); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

func AgentListModelPrices(c *gin.Context) {
	agent, ok := middleware.GetCurrentAgent(c)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "agent not found"})
		return
	}
	prices, err := model.ListAgentModelPrices(agent.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": prices})
}

func AgentUpsertModelPrice(c *gin.Context) {
	agent, ok := middleware.GetCurrentAgent(c)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "agent not found"})
		return
	}
	var price model.AgentModelPrice
	if err := c.ShouldBindJSON(&price); err != nil {
		common.ApiError(c, err)
		return
	}
	price.AgentId = agent.Id
	if err := model.UpsertAgentModelPrice(&price); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": price})
}

func AgentDeleteModelPrice(c *gin.Context) {
	agent, ok := middleware.GetCurrentAgent(c)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "agent not found"})
		return
	}
	modelName := strings.TrimSpace(c.Param("model"))
	if err := model.DeleteAgentModelPrice(agent.Id, modelName); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

func AgentListUsers(c *gin.Context) {
	agent, ok := middleware.GetCurrentAgent(c)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "agent not found"})
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("p", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	users, total, err := model.ListUsersByAgentId(agent.Id, (page-1)*pageSize, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"items": users, "total": total, "page": page, "page_size": pageSize,
		},
	})
}

type updateAgentUserRequest struct {
	Status          *int    `json:"status"`
	Group           *string `json:"group"`
	AgentMemberRole *string `json:"agent_member_role"`
}

func AgentUpdateUser(c *gin.Context) {
	agent, ok := middleware.GetCurrentAgent(c)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "agent not found"})
		return
	}
	userId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid user id"})
		return
	}
	user, err := model.GetUserById(userId, false)
	if err != nil || user.AgentId != agent.Id {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "user not found"})
		return
	}
	var req updateAgentUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	fields := map[string]any{}
	if req.Status != nil {
		fields["status"] = *req.Status
	}
	if req.Group != nil {
		groupName := strings.TrimSpace(*req.Group)
		if !middlewareAgentOwnsGroup(agent.Id, groupName) {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid group"})
			return
		}
		fields["group"] = groupName
	}
	if req.AgentMemberRole != nil {
		role := strings.ToLower(strings.TrimSpace(*req.AgentMemberRole))
		if role != model.AgentMemberRoleUser && role != model.AgentMemberRoleSales {
			c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid member role"})
			return
		}
		fields["agent_member_role"] = role
	}
	if len(fields) == 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "no fields to update"})
		return
	}
	if err := model.DB.Model(&model.User{}).Where("id = ? AND agent_id = ?", userId, agent.Id).Updates(fields).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

type agentAdjustUserQuotaRequest struct {
	Mode  string `json:"mode"`
	Value int    `json:"value"`
}

func AgentAdjustUserQuota(c *gin.Context) {
	agent, ok := middleware.GetCurrentAgent(c)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "agent not found"})
		return
	}
	userId, err := strconv.Atoi(c.Param("id"))
	if err != nil || userId <= 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid user id"})
		return
	}
	user, err := model.GetUserById(userId, false)
	if err != nil || user == nil || user.AgentId != agent.Id {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "user not found"})
		return
	}
	var req agentAdjustUserQuotaRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	adjustManagedUserQuota(c, userId, req.Mode, req.Value, model.AuditFields{
		"agent_id": agent.Id,
	})
}

func middlewareAgentOwnsGroup(agentId int, name string) bool {
	group, err := model.GetAgentGroup(agentId, name)
	return err == nil && group.Enabled
}

func AgentGetPaymentConfig(c *gin.Context) {
	agent, ok := middleware.GetCurrentAgent(c)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "agent not found"})
		return
	}
	cfg, err := agent.GetPaymentConfig()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": cfg.PublicView()})
}

func AgentUpdatePaymentConfig(c *gin.Context) {
	agent, ok := middleware.GetCurrentAgent(c)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "agent not found"})
		return
	}
	current, err := agent.GetPaymentConfig()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var patch map[string]any
	if err := common.DecodeJson(c.Request.Body, &patch); err != nil {
		common.ApiError(c, err)
		return
	}
	merged := current

	if v, ok := patch["price"].(float64); ok {
		merged.Price = v
	}
	if v, ok := patch["min_topup"].(float64); ok {
		merged.MinTopUp = int(v)
	}
	if raw, ok := patch["amount_options"]; ok {
		b, _ := common.Marshal(raw)
		var options []int
		_ = common.Unmarshal(b, &options)
		if options == nil {
			options = []int{}
		}
		merged.AmountOptions = options
	}
	if raw, ok := patch["amount_discount"]; ok {
		b, _ := common.Marshal(raw)
		var discount map[int]float64
		_ = common.Unmarshal(b, &discount)
		if discount == nil {
			discount = map[int]float64{}
		}
		merged.AmountDiscount = discount
	}
	if v, ok := patch["epay_enabled"].(bool); ok {
		merged.EpayEnabled = v
	}
	if v, ok := patch["pay_address"].(string); ok {
		merged.PayAddress = strings.TrimSpace(v)
	}
	if v, ok := patch["custom_callback_address"].(string); ok {
		merged.CustomCallbackAddress = strings.TrimSpace(v)
	}
	if v, ok := patch["epay_id"].(string); ok {
		v = strings.TrimSpace(v)
		if v != "" && !strings.Contains(v, "*") {
			merged.EpayId = v
		}
	}
	if v, ok := patch["epay_key"].(string); ok {
		v = strings.TrimSpace(v)
		if v != "" {
			merged.EpayKey = v
		}
	}
	if raw, ok := patch["pay_methods"]; ok {
		b, _ := common.Marshal(raw)
		var methods []map[string]string
		_ = common.Unmarshal(b, &methods)
		if methods == nil {
			methods = []map[string]string{}
		}
		merged.PayMethods = methods
	}
	if v, ok := patch["stripe_enabled"].(bool); ok {
		merged.StripeEnabled = v
	}
	if v, ok := patch["stripe_api_secret"].(string); ok {
		v = strings.TrimSpace(v)
		if v != "" {
			merged.StripeApiSecret = v
		}
	}
	if v, ok := patch["stripe_webhook_secret"].(string); ok {
		v = strings.TrimSpace(v)
		if v != "" {
			merged.StripeWebhookSecret = v
		}
	}
	if v, ok := patch["stripe_price_id"].(string); ok {
		merged.StripePriceId = strings.TrimSpace(v)
	}
	if v, ok := patch["stripe_unit_price"].(float64); ok {
		merged.StripeUnitPrice = v
	}
	if v, ok := patch["stripe_min_topup"].(float64); ok {
		merged.StripeMinTopUp = int(v)
	}
	if v, ok := patch["stripe_promotion_codes_enabled"].(bool); ok {
		merged.StripePromotionCodesEnabled = v
	}

	if err := agent.SetPaymentConfig(merged); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": merged.PublicView()})
}

func AgentListSettlementBills(c *gin.Context) {
	agent, ok := middleware.GetCurrentAgent(c)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "agent not found"})
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("p", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	bills, total, err := model.ListAgentSettlementBills(agent.Id, (page-1)*pageSize, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"items": bills, "total": total, "page": page, "page_size": pageSize,
			"settlement_debt": agent.SettlementDebt,
			"credit_limit":    agent.CreditLimit,
		},
	})
}
