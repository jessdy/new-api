package model

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

func (channel *Channel) GetCostPricingMap() map[string]PricingValues {
	if channel == nil || channel.CostPricing == nil || strings.TrimSpace(*channel.CostPricing) == "" {
		return nil
	}
	var pricing map[string]PricingValues
	if err := common.UnmarshalJsonStr(*channel.CostPricing, &pricing); err != nil || len(pricing) == 0 {
		return nil
	}
	return pricing
}

func (channel *Channel) CostPricingForModel(modelName string) (PricingValues, bool) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return nil, false
	}
	pricing := channel.GetCostPricingMap()
	if values, ok := pricing[modelName]; ok && len(values) > 0 {
		return values, true
	}
	return nil, false
}

func GetChannelModelCostPricing(channelId int, modelName string) (PricingValues, bool) {
	if channelId <= 0 || strings.TrimSpace(modelName) == "" {
		return nil, false
	}
	channel, err := CacheGetChannel(channelId)
	if err != nil || channel == nil {
		return nil, false
	}
	return channel.CostPricingForModel(modelName)
}

func (channel *Channel) NormalizeCostPricing() error {
	if channel == nil {
		return nil
	}
	if channel.CostPricing == nil || strings.TrimSpace(*channel.CostPricing) == "" {
		channel.CostPricing = nil
		return nil
	}
	var pricing map[string]PricingValues
	if err := common.UnmarshalJsonStr(*channel.CostPricing, &pricing); err != nil {
		return fmt.Errorf("cost pricing must be a JSON object of model → pricing")
	}
	allowed := make(map[string]struct{})
	for _, modelName := range channel.GetModels() {
		modelName = strings.TrimSpace(modelName)
		if modelName != "" {
			allowed[modelName] = struct{}{}
		}
	}
	normalized := make(map[string]PricingValues, len(pricing))
	for modelName, values := range pricing {
		modelName = strings.TrimSpace(modelName)
		if modelName == "" || len(values) == 0 {
			continue
		}
		if len(allowed) > 0 {
			if _, ok := allowed[modelName]; !ok {
				continue
			}
		}
		if err := ValidateModelPricing(modelName, values); err != nil {
			return fmt.Errorf("cost pricing for %s: %w", modelName, err)
		}
		normalized[modelName] = values
	}
	if len(normalized) == 0 {
		channel.CostPricing = nil
		return nil
	}
	encoded, err := common.Marshal(normalized)
	if err != nil {
		return err
	}
	text := string(encoded)
	channel.CostPricing = &text
	return nil
}
