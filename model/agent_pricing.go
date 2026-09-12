package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// AgentPricingSettings stores agent-owned extras that mirror platform group pricing.
type AgentPricingSettings struct {
	GroupGroupRatio         map[string]map[string]float64 `json:"group_group_ratio"`
	AutoGroups              []string                      `json:"auto_groups"`
	MaxTokenAutoGroups      int                           `json:"max_token_auto_groups"`
	DefaultUseAutoGroup     bool                          `json:"default_use_auto_group"`
	GroupSpecialUsableGroup map[string]map[string]string  `json:"group_special_usable_group"`
}

// AgentGroupPricingView is the admin-compatible payload for agent group pricing UI.
type AgentGroupPricingView struct {
	GroupRatio              map[string]float64            `json:"group_ratio"`
	TopupGroupRatio         map[string]float64            `json:"topup_group_ratio"`
	UserUsableGroups        map[string]string             `json:"user_usable_groups"`
	GroupGroupRatio         map[string]map[string]float64 `json:"group_group_ratio"`
	AutoGroups              []string                      `json:"auto_groups"`
	MaxTokenAutoGroups      int                           `json:"max_token_auto_groups"`
	DefaultUseAutoGroup     bool                          `json:"default_use_auto_group"`
	GroupSpecialUsableGroup map[string]map[string]string  `json:"group_special_usable_group"`
}

func (a *Agent) GetPricingSettings() (AgentPricingSettings, error) {
	cfg := AgentPricingSettings{
		GroupGroupRatio:         map[string]map[string]float64{},
		AutoGroups:              []string{},
		MaxTokenAutoGroups:      0,
		GroupSpecialUsableGroup: map[string]map[string]string{},
	}
	if a == nil || strings.TrimSpace(a.PricingConfig) == "" {
		return cfg, nil
	}
	if err := common.UnmarshalJsonStr(a.PricingConfig, &cfg); err != nil {
		return cfg, err
	}
	if cfg.GroupGroupRatio == nil {
		cfg.GroupGroupRatio = map[string]map[string]float64{}
	}
	if cfg.AutoGroups == nil {
		cfg.AutoGroups = []string{}
	}
	if cfg.GroupSpecialUsableGroup == nil {
		cfg.GroupSpecialUsableGroup = map[string]map[string]string{}
	}
	return cfg, nil
}

func (a *Agent) SetPricingSettings(cfg AgentPricingSettings) error {
	if a == nil {
		return ErrAgentNotFound
	}
	if cfg.GroupGroupRatio == nil {
		cfg.GroupGroupRatio = map[string]map[string]float64{}
	}
	if cfg.AutoGroups == nil {
		cfg.AutoGroups = []string{}
	}
	if cfg.GroupSpecialUsableGroup == nil {
		cfg.GroupSpecialUsableGroup = map[string]map[string]string{}
	}
	raw, err := common.Marshal(cfg)
	if err != nil {
		return err
	}
	a.PricingConfig = string(raw)
	return UpdateAgentFields(a.Id, map[string]any{"pricing_config": a.PricingConfig})
}

func GetAgentGroupPricingView(agentId int) (AgentGroupPricingView, error) {
	view := AgentGroupPricingView{
		GroupRatio:              map[string]float64{},
		TopupGroupRatio:         map[string]float64{},
		UserUsableGroups:        map[string]string{},
		GroupGroupRatio:         map[string]map[string]float64{},
		AutoGroups:              []string{},
		GroupSpecialUsableGroup: map[string]map[string]string{},
	}
	agent, err := GetAgentById(agentId)
	if err != nil {
		return view, err
	}
	groups, err := ListAgentGroups(agentId)
	if err != nil {
		return view, err
	}
	for _, group := range groups {
		if group == nil || !group.Enabled {
			continue
		}
		view.GroupRatio[group.Name] = group.Ratio
		view.TopupGroupRatio[group.Name] = group.TopupRatio
		if group.Selectable {
			desc := group.Description
			if desc == "" {
				desc = group.Name
			}
			view.UserUsableGroups[group.Name] = desc
		}
	}
	settings, err := agent.GetPricingSettings()
	if err != nil {
		return view, err
	}
	view.GroupGroupRatio = settings.GroupGroupRatio
	view.AutoGroups = settings.AutoGroups
	view.MaxTokenAutoGroups = settings.MaxTokenAutoGroups
	view.DefaultUseAutoGroup = settings.DefaultUseAutoGroup
	view.GroupSpecialUsableGroup = settings.GroupSpecialUsableGroup
	return view, nil
}

func ReplaceAgentGroupPricing(agentId int, view AgentGroupPricingView) error {
	if agentId <= 0 {
		return ErrAgentNotFound
	}
	if view.GroupRatio == nil {
		view.GroupRatio = map[string]float64{}
	}
	if len(view.GroupRatio) == 0 {
		view.GroupRatio["default"] = 1
	}
	if view.TopupGroupRatio == nil {
		view.TopupGroupRatio = map[string]float64{}
	}
	if view.UserUsableGroups == nil {
		view.UserUsableGroups = map[string]string{}
	}
	if _, ok := view.UserUsableGroups["default"]; !ok {
		if _, hasDefault := view.GroupRatio["default"]; hasDefault {
			view.UserUsableGroups["default"] = "Default"
		}
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("agent_id = ?", agentId).Delete(&AgentGroup{}).Error; err != nil {
			return err
		}
		defaultName := ""
		for name, ratio := range view.GroupRatio {
			name = strings.TrimSpace(name)
			if name == "" {
				continue
			}
			if ratio <= 0 {
				return errors.New("group ratio must be positive")
			}
			topup := view.TopupGroupRatio[name]
			if topup <= 0 {
				topup = 1
			}
			desc, selectable := view.UserUsableGroups[name]
			if selectable && desc == "" {
				desc = name
			}
			isDefault := name == "default" || (defaultName == "" && selectable)
			if isDefault && defaultName == "" {
				defaultName = name
			}
			group := &AgentGroup{
				AgentId:     agentId,
				Name:        name,
				Ratio:       ratio,
				TopupRatio:  topup,
				Description: desc,
				Selectable:  selectable,
				Enabled:     true,
				IsDefault:   name == defaultName,
			}
			if err := tx.Create(group).Error; err != nil {
				return err
			}
		}
		if defaultName == "" {
			// Ensure at least one default row exists.
			if err := tx.Create(&AgentGroup{
				AgentId:     agentId,
				Name:        "default",
				Ratio:       1,
				TopupRatio:  1,
				Description: "Default",
				Selectable:  true,
				Enabled:     true,
				IsDefault:   true,
			}).Error; err != nil {
				return err
			}
		}

		settings := AgentPricingSettings{
			GroupGroupRatio:         view.GroupGroupRatio,
			AutoGroups:              view.AutoGroups,
			MaxTokenAutoGroups:      view.MaxTokenAutoGroups,
			DefaultUseAutoGroup:     view.DefaultUseAutoGroup,
			GroupSpecialUsableGroup: view.GroupSpecialUsableGroup,
		}
		if settings.GroupGroupRatio == nil {
			settings.GroupGroupRatio = map[string]map[string]float64{}
		}
		if settings.AutoGroups == nil {
			settings.AutoGroups = []string{}
		}
		if settings.GroupSpecialUsableGroup == nil {
			settings.GroupSpecialUsableGroup = map[string]map[string]string{}
		}
		raw, err := common.Marshal(settings)
		if err != nil {
			return err
		}
		return tx.Model(&Agent{}).Where("id = ?", agentId).Update("pricing_config", string(raw)).Error
	})
}

func GetAgentGroupGroupRatio(agentId int, userGroup, usingGroup string) (float64, bool) {
	if agentId <= 0 || userGroup == "" || usingGroup == "" {
		return 1, false
	}
	agent, err := GetAgentById(agentId)
	if err != nil {
		return 1, false
	}
	settings, err := agent.GetPricingSettings()
	if err != nil {
		return 1, false
	}
	byUser, ok := settings.GroupGroupRatio[userGroup]
	if !ok || byUser == nil {
		return 1, false
	}
	ratio, ok := byUser[usingGroup]
	if !ok || ratio <= 0 {
		return 1, false
	}
	return ratio, true
}
