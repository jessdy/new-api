package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const agentUserModelLimitMarker = "__agent_user_model_limit__"

// AgentUserModelSetting stores per-end-user model allowlist and retail pricing
// under an agent. When a user has any rows, only enabled models are usable.
type AgentUserModelSetting struct {
	Id        int    `json:"id"`
	AgentId   int    `json:"agent_id" gorm:"uniqueIndex:uk_agent_user_model;index;not null"`
	UserId    int    `json:"user_id" gorm:"uniqueIndex:uk_agent_user_model;index;not null"`
	Model     string `json:"model" gorm:"type:varchar(255);uniqueIndex:uk_agent_user_model;not null"`
	Enabled   bool   `json:"enabled"`
	Pricing   string `json:"pricing" gorm:"type:text"` // JSON PricingValues; empty = inherit platform/agent price
	UpdatedAt int64  `json:"updated_at" gorm:"bigint;autoUpdateTime"`
}

type AgentUserModelSettingView struct {
	ModelName string        `json:"model_name"`
	Enabled   bool          `json:"enabled"`
	Pricing   PricingValues `json:"pricing,omitempty"`
	Effective PricingValues `json:"effective,omitempty"`
	AgentCost PricingValues `json:"agent_cost,omitempty"`
	Version   string        `json:"version"`
}

type AgentUserModelSettingsPayload struct {
	LimitEnabled bool                         `json:"limit_enabled"`
	Models       []AgentUserModelSettingInput `json:"models"`
}

type AgentUserModelSettingInput struct {
	ModelName string        `json:"model_name"`
	Enabled   bool          `json:"enabled"`
	Pricing   PricingValues `json:"pricing"`
}

func ListAgentUserModelSettings(agentId, userId int) ([]*AgentUserModelSetting, error) {
	var rows []*AgentUserModelSetting
	err := DB.Where("agent_id = ? AND user_id = ?", agentId, userId).
		Order("model asc").Find(&rows).Error
	return rows, err
}

func AgentUserHasModelLimit(userId int) (bool, error) {
	if userId <= 0 {
		return false, nil
	}
	var count int64
	err := DB.Model(&AgentUserModelSetting{}).Where("user_id = ?", userId).Count(&count).Error
	return count > 0, err
}

func AgentUserAllowsModel(userId int, modelName string) (bool, error) {
	modelName = strings.TrimSpace(modelName)
	if userId <= 0 || modelName == "" {
		return true, nil
	}
	limited, err := AgentUserHasModelLimit(userId)
	if err != nil {
		return false, err
	}
	if !limited {
		return true, nil
	}
	var row AgentUserModelSetting
	err = DB.Where("user_id = ? AND model = ? AND enabled = ?", userId, modelName, true).
		First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	return err == nil, err
}

func GetAgentUserModelPricing(userId int, modelName string) (PricingValues, bool) {
	modelName = strings.TrimSpace(modelName)
	if userId <= 0 || modelName == "" {
		return nil, false
	}
	var row AgentUserModelSetting
	err := DB.Where("user_id = ? AND model = ? AND enabled = ?", userId, modelName, true).
		First(&row).Error
	if err != nil || strings.TrimSpace(row.Pricing) == "" || row.Pricing == "{}" || row.Pricing == "null" {
		return nil, false
	}
	var pricing PricingValues
	if err := common.UnmarshalJsonStr(row.Pricing, &pricing); err != nil || len(pricing) == 0 {
		return nil, false
	}
	return pricing, true
}

func ReplaceAgentUserModelSettings(agentId, userId int, payload AgentUserModelSettingsPayload) error {
	if agentId <= 0 || userId <= 0 {
		return errors.New("agent id and user id are required")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("agent_id = ? AND user_id = ?", agentId, userId).
			Delete(&AgentUserModelSetting{}).Error; err != nil {
			return err
		}
		if !payload.LimitEnabled {
			return nil
		}
		seen := make(map[string]struct{})
		for _, item := range payload.Models {
			name := strings.TrimSpace(item.ModelName)
			if name == "" || name == agentUserModelLimitMarker || !item.Enabled {
				continue
			}
			if _, ok := seen[name]; ok {
				continue
			}
			seen[name] = struct{}{}
			pricingJSON := ""
			if len(item.Pricing) > 0 {
				encoded, err := common.Marshal(item.Pricing)
				if err != nil {
					return err
				}
				pricingJSON = string(encoded)
			}
			row := &AgentUserModelSetting{
				AgentId: agentId,
				UserId:  userId,
				Model:   name,
				Enabled: true,
				Pricing: pricingJSON,
			}
			if err := tx.Clauses(clause.OnConflict{
				Columns: []clause.Column{
					{Name: "agent_id"}, {Name: "user_id"}, {Name: "model"},
				},
				DoUpdates: clause.AssignmentColumns([]string{"enabled", "pricing", "updated_at"}),
			}).Create(row).Error; err != nil {
				return err
			}
		}
		// Keep a marker row so an empty allowlist still counts as "limited".
		if len(seen) == 0 {
			marker := &AgentUserModelSetting{
				AgentId: agentId,
				UserId:  userId,
				Model:   agentUserModelLimitMarker,
				Enabled: false,
			}
			if err := tx.Create(marker).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func BuildAgentUserModelSettingsView(agentId, userId int) (AgentUserModelSettingsPayload, []AgentUserModelSettingView, error) {
	available, err := ListAgentModels(agentId)
	if err != nil {
		return AgentUserModelSettingsPayload{}, nil, err
	}
	rows, err := ListAgentUserModelSettings(agentId, userId)
	if err != nil {
		return AgentUserModelSettingsPayload{}, nil, err
	}
	byModel := make(map[string]*AgentUserModelSetting, len(rows))
	for _, row := range rows {
		if row.Model == agentUserModelLimitMarker {
			continue
		}
		byModel[row.Model] = row
	}
	configured := make([]AgentModelListItem, 0, len(available))
	for _, item := range available {
		if item.HasCostOverride {
			configured = append(configured, item)
		}
	}

	views := make([]AgentUserModelSettingView, 0, len(configured))
	limitEnabled := len(rows) > 0
	for _, item := range configured {
		agentCost := make(PricingValues, len(item.CostEffective))
		for key, value := range item.CostEffective {
			agentCost[key] = value
		}
		view := AgentUserModelSettingView{
			ModelName: item.ModelName,
			Enabled:   !limitEnabled,
			Effective: agentCost,
			AgentCost: agentCost,
			Version:   item.CostVersion,
		}
		if row, ok := byModel[item.ModelName]; ok && row.Enabled {
			view.Enabled = true
			if strings.TrimSpace(row.Pricing) != "" && row.Pricing != "{}" && row.Pricing != "null" {
				var pricing PricingValues
				if err := common.UnmarshalJsonStr(row.Pricing, &pricing); err == nil && len(pricing) > 0 {
					view.Pricing = pricing
					view.Version = ModelPricingVersion(pricing)
					// Merge configured over platform effective for display.
					merged := make(PricingValues, len(view.Effective)+len(pricing))
					for k, v := range view.Effective {
						merged[k] = v
					}
					for k, v := range pricing {
						merged[k] = v
					}
					view.Effective = merged
				}
			}
		} else if limitEnabled {
			view.Enabled = false
		}
		views = append(views, view)
	}
	return AgentUserModelSettingsPayload{LimitEnabled: limitEnabled}, views, nil
}

func ListEnabledAgentUserModels(userId int) ([]string, error) {
	var names []string
	err := DB.Model(&AgentUserModelSetting{}).
		Where("user_id = ? AND enabled = ? AND model <> ?", userId, true, agentUserModelLimitMarker).
		Order("model asc").
		Pluck("model", &names).Error
	return names, err
}
