package middleware

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// RequireAgent must run after UserAuth. It loads the caller's agent profile.
func RequireAgent() func(c *gin.Context) {
	return func(c *gin.Context) {
		userId := c.GetInt("id")
		agent, err := model.GetAgentByUserId(userId)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": common.TranslateMessage(c, i18n.MsgAuthInsufficientPrivilege),
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
