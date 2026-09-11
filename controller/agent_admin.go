package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type createAgentRequest struct {
	UserId      int    `json:"user_id"`
	Name        string `json:"name"`
	InviteCode  string `json:"invite_code"`
	CreditLimit int64  `json:"credit_limit"`
	Status      string `json:"status"`
}

type updateAgentRequest struct {
	Name        *string `json:"name"`
	Status      *string `json:"status"`
	CreditLimit *int64  `json:"credit_limit"`
	InviteCode  *string `json:"invite_code"`
}

type createSettlementBillRequest struct {
	PeriodStart   int64 `json:"period_start"`
	PeriodEnd     int64 `json:"period_end"`
	PlatformQuota int64 `json:"platform_quota"`
}

func AdminListAgents(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("p", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	status := strings.TrimSpace(c.Query("status"))
	agents, total, err := model.ListAgents((page-1)*pageSize, pageSize, status)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]map[string]any, 0, len(agents))
	for _, agent := range agents {
		items = append(items, model.AgentPublicSummary(agent))
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items":     items,
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}

func AdminCreateAgent(c *gin.Context) {
	var req createAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.UserId <= 0 || strings.TrimSpace(req.Name) == "" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "user_id and name are required"})
		return
	}
	user, err := model.GetUserById(req.UserId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if _, err := model.GetAgentByUserId(req.UserId); err == nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "user is already an agent"})
		return
	}
	status := req.Status
	if status == "" {
		status = model.AgentStatusEnabled
	}
	agent := &model.Agent{
		UserId:      req.UserId,
		Name:        strings.TrimSpace(req.Name),
		InviteCode:  strings.TrimSpace(req.InviteCode),
		CreditLimit: req.CreditLimit,
		Status:      status,
	}
	if err := model.CreateAgent(agent); err != nil {
		common.ApiError(c, err)
		return
	}
	_ = model.EnsureAgentDefaultGroup(agent.Id)
	if user.Role < common.RoleAgentUser {
		_ = model.DB.Model(&model.User{}).Where("id = ?", user.Id).Update("role", common.RoleAgentUser).Error
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": model.AgentPublicSummary(agent)})
}

func AdminUpdateAgent(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid id"})
		return
	}
	var req updateAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	fields := map[string]any{}
	if req.Name != nil {
		fields["name"] = strings.TrimSpace(*req.Name)
	}
	if req.Status != nil {
		fields["status"] = strings.TrimSpace(*req.Status)
	}
	if req.CreditLimit != nil {
		fields["credit_limit"] = *req.CreditLimit
	}
	if req.InviteCode != nil {
		fields["invite_code"] = strings.TrimSpace(*req.InviteCode)
	}
	if len(fields) == 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "no fields to update"})
		return
	}
	if err := model.UpdateAgentFields(id, fields); err != nil {
		common.ApiError(c, err)
		return
	}
	agent, err := model.GetAgentById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": model.AgentPublicSummary(agent)})
}

func AdminCreateAgentSettlementBill(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid id"})
		return
	}
	var req createSettlementBillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	agent, err := model.GetAgentById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	quota := req.PlatformQuota
	if quota <= 0 {
		quota = agent.SettlementDebt
	}
	bill := &model.AgentSettlementBill{
		AgentId:       id,
		PeriodStart:   req.PeriodStart,
		PeriodEnd:     req.PeriodEnd,
		PlatformQuota: quota,
		Status:        model.AgentSettlementBillStatusInvoiced,
	}
	if err := model.CreateAgentSettlementBill(bill); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": bill})
}

func AdminMarkAgentSettlementBillPaid(c *gin.Context) {
	billId, err := strconv.Atoi(c.Param("bill_id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid bill id"})
		return
	}
	if err := model.MarkAgentSettlementBillPaid(billId); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
}

func AdminListAgentSettlementBills(c *gin.Context) {
	agentId, _ := strconv.Atoi(c.Query("agent_id"))
	page, _ := strconv.Atoi(c.DefaultQuery("p", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	bills, total, err := model.ListAgentSettlementBills(agentId, (page-1)*pageSize, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"items": bills, "total": total, "page": page, "page_size": pageSize,
		},
	})
}
