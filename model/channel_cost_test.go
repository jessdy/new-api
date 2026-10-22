package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeCostPricingKeepsConfiguredModels(t *testing.T) {
	encoded, err := common.Marshal(map[string]PricingValues{
		"gpt-4":       {"ModelPrice": 0.5},
		"removed-one": {"ModelPrice": 0.1},
	})
	require.NoError(t, err)
	text := string(encoded)
	channel := &Channel{
		Models:      "gpt-4,claude-3",
		CostPricing: &text,
	}

	require.NoError(t, channel.NormalizeCostPricing())
	pricing := channel.GetCostPricingMap()
	require.Len(t, pricing, 1)
	assert.Equal(t, 0.5, pricing["gpt-4"]["ModelPrice"])
	values, ok := channel.CostPricingForModel("gpt-4")
	require.True(t, ok)
	assert.Equal(t, 0.5, values["ModelPrice"])
	_, ok = channel.CostPricingForModel("removed-one")
	assert.False(t, ok)
}

func TestNormalizeCostPricingRejectsInvalidJSON(t *testing.T) {
	text := `["not-an-object"]`
	channel := &Channel{CostPricing: &text}
	err := channel.NormalizeCostPricing()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "JSON object")
}

func TestSettlementFactReadsChannelQuota(t *testing.T) {
	other, err := common.Marshal(map[string]any{
		"admin_info": map[string]any{
			"platform_quota": 80,
			"channel_quota":  30,
		},
		"model_ratio": 2,
	})
	require.NoError(t, err)

	fact := settlementFactFromLog(10, 4, string(other))
	assert.Equal(t, int64(80), fact.platformQuota)
	assert.Equal(t, int64(30), fact.channelQuota)

	byModel := make(map[string]*settlementModelAccum)
	addSettlementModel(byModel, "gpt-4", 100, fact)
	models := finishSettlementModels(byModel)
	require.Len(t, models, 1)
	assert.Equal(t, int64(100), models[0].Quota)
	assert.Equal(t, int64(80), models[0].PlatformQuota)
	assert.Equal(t, int64(30), models[0].ChannelQuota)
}
