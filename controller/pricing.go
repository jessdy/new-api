package controller

import (
	"maps"
	"slices"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func filterPricingByUsableGroups(pricing []model.Pricing, usableGroup map[string]string) []model.Pricing {
	if len(pricing) == 0 {
		return pricing
	}
	if len(usableGroup) == 0 {
		return []model.Pricing{}
	}

	filtered := make([]model.Pricing, 0, len(pricing))
	for _, item := range pricing {
		if common.StringsContains(item.EnableGroup, "all") {
			filtered = append(filtered, item)
			continue
		}
		for _, group := range item.EnableGroup {
			if _, ok := usableGroup[group]; ok {
				filtered = append(filtered, item)
				break
			}
		}
	}
	return filtered
}

func GetPricing(c *gin.Context) {
	basePricing := model.GetPricing()
	pricing := append([]model.Pricing(nil), basePricing...)
	userId, exists := c.Get("id")
	usableGroup := map[string]string{}
	groupRatio := map[string]float64{}
	maps.Copy(groupRatio, ratio_setting.GetGroupRatioCopy())
	var user *model.UserBase
	if exists {
		cached, err := model.GetUserCache(userId.(int))
		if err != nil {
			common.ApiError(c, err)
			return
		}
		user = cached
		if cached.AgentId > 0 {
			view, viewErr := model.GetAgentGroupPricingView(cached.AgentId)
			if viewErr == nil {
				groupRatio = maps.Clone(view.GroupRatio)
				for g := range groupRatio {
					if ratio, ok := service.GetAgentGroupGroupRatio(cached.AgentId, cached.Group, g); ok {
						groupRatio[g] = ratio
					}
				}
			}
		} else {
			for g := range groupRatio {
				ratio, ok := ratio_setting.GetGroupGroupRatio(cached.Group, g)
				if ok {
					groupRatio[g] = ratio
				}
			}
		}
	}

	if user != nil {
		usableGroup = service.GetUserUsableGroupsForUser(&model.User{AgentId: user.AgentId, Group: user.Group})
	} else {
		usableGroup = service.GetUserUsableGroups("")
	}
	modelNames := make([]string, len(pricing))
	for i := range pricing {
		modelNames[i] = pricing[i].ModelName
	}
	effectivePricing, err := model.ResolveEffectivePricingCatalog(user, modelNames)
	if err != nil {
		c.JSON(500, gin.H{"success": false, "message": err.Error()})
		return
	}
	filteredPricing := make([]model.Pricing, 0, len(pricing))
	for _, item := range pricing {
		effective := effectivePricing[item.ModelName]
		if !effective.Allowed {
			continue
		}
		item = item.WithPricingValues(effective.Pricing)
		item.PricingMultiplier = effective.DiscountRatio
		if common.StringsContains(item.EnableGroup, "all") {
			item.EnableGroup = make([]string, 0, len(usableGroup))
			for group := range usableGroup {
				item.EnableGroup = append(item.EnableGroup, group)
			}
			slices.Sort(item.EnableGroup)
		}
		filteredPricing = append(filteredPricing, item)
	}
	pricing = filterPricingByUsableGroups(filteredPricing, usableGroup)
	for name := range groupRatio {
		if _, ok := usableGroup[name]; !ok {
			delete(groupRatio, name)
		}
	}

	autoGroups := []string{}
	if user != nil {
		autoGroups = service.GetUserAutoGroupForUser(&model.User{AgentId: user.AgentId, Group: user.Group})
	}

	c.JSON(200, gin.H{
		"success":            true,
		"data":               pricing,
		"vendors":            model.GetVendors(),
		"group_ratio":        groupRatio,
		"usable_group":       usableGroup,
		"supported_endpoint": model.GetSupportedEndpointMap(),
		"auto_groups":        autoGroups,
		"pricing_version":    "a42d372ccf0b5dd13ecf71203521f9d2",
	})
}

func ResetModelRatio(c *gin.Context) {
	defaultStr := ratio_setting.DefaultModelRatio2JSONString()
	err := model.UpdateOption("ModelRatio", defaultStr)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	err = ratio_setting.UpdateModelRatioByJSONString(defaultStr)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"message": "重置模型倍率成功",
	})
}
