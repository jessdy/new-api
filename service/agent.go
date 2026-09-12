package service

import (
	"errors"
	"net/http"
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting"
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

func GetAgentGroupGroupRatio(agentId int, userGroup, usingGroup string) (float64, bool) {
	return model.GetAgentGroupGroupRatio(agentId, userGroup, usingGroup)
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
		if group == nil || !group.Enabled || !group.Selectable {
			continue
		}
		desc := group.Description
		if desc == "" {
			desc = group.Name
		}
		result[group.Name] = desc
	}
	return result
}

func ApplyAgentSpecialUsableGroups(agentId int, userGroup string, base map[string]string) map[string]string {
	if agentId <= 0 || base == nil {
		return base
	}
	agent, err := model.GetAgentById(agentId)
	if err != nil {
		return base
	}
	settings, err := agent.GetPricingSettings()
	if err != nil {
		return base
	}
	specialSettings, ok := settings.GroupSpecialUsableGroup[userGroup]
	if !ok || specialSettings == nil {
		if userGroup != "" {
			if _, exists := base[userGroup]; !exists {
				base[userGroup] = userGroup
			}
		}
		return base
	}
	for specialGroup, desc := range specialSettings {
		if after, cut := strings.CutPrefix(specialGroup, "-:"); cut {
			delete(base, after)
			continue
		}
		if after, cut := strings.CutPrefix(specialGroup, "+:"); cut {
			base[after] = desc
			continue
		}
		base[specialGroup] = desc
	}
	if userGroup != "" {
		if _, exists := base[userGroup]; !exists {
			base[userGroup] = userGroup
		}
	}
	return base
}

func GetAgentAutoGroups(agentId int, userGroup string) []string {
	if agentId <= 0 {
		return nil
	}
	agent, err := model.GetAgentById(agentId)
	if err != nil {
		return nil
	}
	settings, err := agent.GetPricingSettings()
	if err != nil {
		return nil
	}
	usable := ApplyAgentSpecialUsableGroups(agentId, userGroup, ListAgentUsableGroups(agentId))
	result := make([]string, 0, len(settings.AutoGroups))
	seen := map[string]struct{}{}
	for _, name := range settings.AutoGroups {
		if _, ok := usable[name]; !ok {
			continue
		}
		if !AgentOwnsGroup(agentId, name) {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		result = append(result, name)
	}
	return result
}

func GetAgentMaxTokenAutoGroups(agentId int) int {
	if agentId <= 0 {
		return setting.GetMaxTokenAutoGroups()
	}
	agent, err := model.GetAgentById(agentId)
	if err != nil {
		return setting.GetMaxTokenAutoGroups()
	}
	settings, err := agent.GetPricingSettings()
	if err != nil || settings.MaxTokenAutoGroups <= 0 {
		return setting.GetMaxTokenAutoGroups()
	}
	return settings.MaxTokenAutoGroups
}

func AgentDefaultUseAutoGroup(agentId int) bool {
	if agentId <= 0 {
		return setting.DefaultUseAutoGroup
	}
	agent, err := model.GetAgentById(agentId)
	if err != nil {
		return setting.DefaultUseAutoGroup
	}
	settings, err := agent.GetPricingSettings()
	if err != nil {
		return setting.DefaultUseAutoGroup
	}
	return settings.DefaultUseAutoGroup
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
