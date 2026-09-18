package middleware

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// RequireAgent must run after UserAuth. It loads the caller's agent profile.
// Admins/root may manage any agent by passing ?agent_id=; they may also use
// their own agent profile when one exists.
func RequireAgent() func(c *gin.Context) {
	return func(c *gin.Context) {
		userId := c.GetInt("id")
		role := c.GetInt("role")

		if role >= common.RoleAdminUser {
			if raw := c.Query("agent_id"); raw != "" {
				agentId, err := strconv.Atoi(raw)
				if err != nil || agentId <= 0 {
					c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
						"success": false,
						"message": "invalid agent_id",
					})
					return
				}
				agent, err := model.GetAgentById(agentId)
				if err != nil {
					c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
						"success": false,
						"message": "agent not found",
					})
					return
				}
				c.Set("agent_id", agent.Id)
				c.Set("agent", agent)
				c.Next()
				return
			}
			if agent, err := model.GetAgentByUserId(userId); err == nil {
				if agent.Status == model.AgentStatusDisabled {
					c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
						"success": false,
						"message": "agent is disabled",
					})
					return
				}
				c.Set("agent_id", agent.Id)
				c.Set("agent", agent)
				c.Next()
				return
			}
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": common.TranslateMessage(c, i18n.MsgAgentAdminAgentIdRequired),
			})
			return
		}

		agent, err := model.GetAgentByUserId(userId)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": common.TranslateMessage(c, i18n.MsgAgentProfileRequired),
			})
			return
		}
		if agent.Status == model.AgentStatusDisabled {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": "agent is disabled",
			})
			return
		}
		c.Set("agent_id", agent.Id)
		c.Set("agent", agent)
		c.Next()
	}
}

func GetCurrentAgent(c *gin.Context) (*model.Agent, bool) {
	if v, ok := c.Get("agent"); ok {
		if agent, ok := v.(*model.Agent); ok && agent != nil {
			return agent, true
		}
	}
	userId := c.GetInt("id")
	agent, err := model.GetAgentByUserId(userId)
	if err != nil {
		return nil, false
	}
	return agent, true
}

// ResolveAgentRequest applies an agent's channel pool, credit gate, and pricing
// context to dashboard-authenticated relay requests, including the playground.
func ResolveAgentRequest() gin.HandlerFunc {
	return func(c *gin.Context) {
		agentId, err := service.ResolveRequestAgentID(
			c.GetInt("id"),
			c.GetInt("role"),
			common.GetContextKeyInt(c, constant.ContextKeyUserAgentId),
		)
		if err != nil {
			abortWithOpenAiMessage(c, http.StatusForbidden, "agent not found")
			return
		}
		if agentId > 0 {
			if apiErr := service.EnsureAgentRequestAllowed(c, agentId); apiErr != nil {
				abortWithOpenAiMessage(c, apiErr.StatusCode, apiErr.Error())
				return
			}
		}
		c.Next()
	}
}
