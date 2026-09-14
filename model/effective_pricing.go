package model

import (
	"errors"
	"maps"
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const (
	PricingSourcePlatform  = "platform"
	PricingSourceAgentCost = "agent_cost"
	PricingSourceAgentUser = "agent_user"
)

// EffectiveModelPricing identifies the retail pricing contract for one user
// and model. Empty Pricing means the platform pricing is inherited.
type EffectiveModelPricing struct {
	Pricing       PricingValues
	Source        string
	AgentId       int
	Allowed       bool
	DiscountRatio float64
}

func platformEffectivePricing() EffectiveModelPricing {
	return EffectiveModelPricing{
		Source:        PricingSourcePlatform,
		Allowed:       true,
		DiscountRatio: 1,
	}
}

func ResolveEffectivePricingCatalog(user *UserBase, modelNames []string) (map[string]EffectiveModelPricing, error) {
	result := make(map[string]EffectiveModelPricing, len(modelNames))
	for _, modelName := range modelNames {
		result[modelName] = platformEffectivePricing()
	}
	if user == nil {
		return result, nil
	}

	if user.Role == common.RoleAgentUser {
		agent, err := GetAgentByUserId(user.Id)
		if err != nil {
			for _, modelName := range modelNames {
				item := platformEffectivePricing()
				item.Allowed = false
				result[modelName] = item
			}
			return result, nil
		}
		available, err := ListAgentModels(agent.Id)
		if err != nil {
			return nil, err
		}
		byName := make(map[string]AgentModelListItem, len(available))
		for _, item := range available {
			if item.HasCostOverride && len(item.ChannelIds) > 0 {
				byName[item.ModelName] = item
			}
		}
		for _, modelName := range modelNames {
			effective := platformEffectivePricing()
			effective.Source = PricingSourceAgentCost
			effective.AgentId = agent.Id
			effective.Allowed = false
			if item, ok := byName[modelName]; ok {
				effective.Allowed = true
				effective.Pricing = maps.Clone(item.CostEffective)
			}
			result[modelName] = effective
		}
		return result, nil
	}

	if user.AgentId <= 0 {
		return result, nil
	}
	rows, err := ListAgentUserModelSettings(user.AgentId, user.Id)
	if err != nil {
		return nil, err
	}
	limited := len(rows) > 0
	settings := make(map[string]*AgentUserModelSetting, len(rows))
	for _, row := range rows {
		if row != nil && row.Model != agentUserModelLimitMarker {
			settings[row.Model] = row
		}
	}
	prices, err := ListAgentModelPrices(user.AgentId)
	if err != nil {
		return nil, err
	}
	discounts := make(map[string]float64, len(prices))
	for _, price := range prices {
		if price != nil && price.DiscountRatio > 0 {
			discounts[price.Model] = price.DiscountRatio
		}
	}
	for _, modelName := range modelNames {
		effective := platformEffectivePricing()
		effective.AgentId = user.AgentId
		row, configured := settings[modelName]
		if limited && (!configured || !row.Enabled) {
			effective.Allowed = false
			result[modelName] = effective
			continue
		}
		if configured && row.Enabled {
			var pricing PricingValues
			if strings.TrimSpace(row.Pricing) != "" &&
				common.UnmarshalJsonStr(row.Pricing, &pricing) == nil &&
				len(pricing) > 0 {
				effective.Source = PricingSourceAgentUser
				effective.Pricing = pricing
				result[modelName] = effective
				continue
			}
		}
		if discount, ok := discounts[modelName]; ok {
			effective.DiscountRatio = discount
		}
		result[modelName] = effective
	}
	return result, nil
}

func ResolveEffectiveModelPricing(user *UserBase, requestedModelName, pricingModelName string) (EffectiveModelPricing, error) {
	requestedModelName = strings.TrimSpace(requestedModelName)
	pricingModelName = strings.TrimSpace(pricingModelName)
	if pricingModelName == "" {
		pricingModelName = requestedModelName
	}
	if requestedModelName == "" {
		return platformEffectivePricing(), nil
	}

	if user == nil {
		return platformEffectivePricing(), nil
	}
	if user.Role == common.RoleAgentUser {
		result := platformEffectivePricing()
		result.Source = PricingSourceAgentCost
		result.Allowed = false
		agent, err := GetAgentByUserId(user.Id)
		if err != nil {
			if errors.Is(err, ErrAgentNotFound) {
				return result, nil
			}
			return result, err
		}
		result.AgentId = agent.Id
		channelIds, err := ListAgentChannelIds(agent.Id)
		if err != nil {
			return result, err
		}
		for _, channelId := range channelIds {
			channel, channelErr := GetChannelById(channelId, false)
			if channelErr == nil && channel != nil && slices.Contains(channel.GetModels(), requestedModelName) {
				result.Allowed = true
				break
			}
		}
		if !result.Allowed {
			return result, nil
		}
		pricing, ok := GetAgentModelCostPricing(agent.Id, pricingModelName)
		if !ok && pricingModelName != requestedModelName {
			pricing, ok = GetAgentModelCostPricing(agent.Id, requestedModelName)
		}
		if !ok {
			result.Allowed = false
			return result, nil
		}
		result.Pricing = pricing
		return result, nil
	}
	if user.AgentId <= 0 {
		return platformEffectivePricing(), nil
	}

	result := platformEffectivePricing()
	result.AgentId = user.AgentId
	allowed, err := AgentUserAllowsModel(user.Id, requestedModelName)
	if err != nil {
		return result, err
	}
	if !allowed {
		result.Allowed = false
		return result, nil
	}
	pricing, ok := GetAgentUserModelPricing(user.Id, pricingModelName)
	if !ok && pricingModelName != requestedModelName {
		pricing, ok = GetAgentUserModelPricing(user.Id, requestedModelName)
	}
	if ok {
		result.Source = PricingSourceAgentUser
		result.Pricing = pricing
		return result, nil
	}
	discount, ok := GetAgentModelDiscount(user.AgentId, pricingModelName)
	if !ok && pricingModelName != requestedModelName {
		discount, ok = GetAgentModelDiscount(user.AgentId, requestedModelName)
	}
	if ok {
		result.DiscountRatio = discount
	}
	return result, nil
}
