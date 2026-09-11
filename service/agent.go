package service

import (
	"errors"
	"fmt"
	"net/http"
	"slices"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
)

func AppendAgentChannelFilter(c *gin.Context, agentId int) error {
	if c == nil || agentId <= 0 {
		return nil
	}
	ids, err := model.ListAgentChannelIds(agentId)
	if err != nil {
		return err
	}
	GetChannelConstraints(c).AddFilter(dto.ChannelFilter{
		Kind:              dto.FilterAgentChannels,
		AllowedChannelIds: ids,
	})
	return nil
}

func EnsureAgentRequestAllowed(c *gin.Context, agentId int) *types.NewAPIError {
	if agentId <= 0 {
		return nil
	}
	agent, err := model.GetAgentById(agentId)
	if err != nil {
		return types.NewErrorWithStatusCode(err, types.ErrorCodeAccessDenied, http.StatusForbidden, types.ErrOptionWithSkipRetry())
	}
	if !agent.IsRequestAllowed() {
		return types.NewErrorWithStatusCode(
			errors.New(model.FormatAgentCreditError(agent)),
			types.ErrorCodeAccessDenied,
			http.StatusForbidden,
			types.ErrOptionWithSkipRetry(),
		)
	}
	if err := AppendAgentChannelFilter(c, agentId); err != nil {
		return types.NewError(err, types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}
	common.SetContextKey(c, constant.ContextKeyUserAgentId, agentId)
	return nil
}

func GetAgentGroupRatio(agentId int, groupName string) (float64, bool) {
	if agentId <= 0 || groupName == "" || groupName == "auto" {
		return 1, false
	}
	group, err := model.GetAgentGroup(agentId, groupName)
	if err != nil || !group.Enabled || group.Ratio <= 0 {
		return 1, false
	}
	return group.Ratio, true
}

func GetAgentTopupRatio(agentId int, groupName string) float64 {
	if agentId <= 0 {
		return 1
	}
	group, err := model.GetAgentGroup(agentId, groupName)
	if err != nil || group.TopupRatio <= 0 {
		return 1
	}
	return group.TopupRatio
}

func AgentOwnsGroup(agentId int, groupName string) bool {
	if agentId <= 0 {
		return false
	}
	if groupName == "auto" {
		return true
	}
	group, err := model.GetAgentGroup(agentId, groupName)
	return err == nil && group.Enabled
}

func ListAgentUsableGroups(agentId int) map[string]string {
	result := map[string]string{}
	if agentId <= 0 {
		return result
	}
	groups, err := model.ListAgentGroups(agentId)
	if err != nil {
		return result
	}
	for _, group := range groups {
		if group == nil || !group.Enabled {
			continue
		}
		result[group.Name] = fmt.Sprintf("Agent group %s", group.Name)
	}
	return result
}

func ApplyAgentPricing(agentId int, modelName string, groupRatio float64) (effectiveRatio float64, discount float64) {
	effectiveRatio = groupRatio
	discount = 1
	if agentId <= 0 {
		return effectiveRatio, discount
	}
	if d, ok := model.GetAgentModelDiscount(agentId, modelName); ok {
		discount = d
		effectiveRatio = groupRatio * d
	}
	return effectiveRatio, discount
}

func AccrueAgentPlatformQuota(agentId int, platformQuota int) {
	if agentId <= 0 || platformQuota <= 0 {
		return
	}
	_ = model.AccrueAgentSettlementDebt(agentId, int64(platformQuota))
}

func ResolveAgentChannelIds(agentId int) ([]int, error) {
	ids, err := model.ListAgentChannelIds(agentId)
	if err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return nil, errors.New("agent has no selected channels")
	}
	return ids, nil
}

func ChannelAllowedForAgent(channelId int, allowed []int) bool {
	return slices.Contains(allowed, channelId)
}
