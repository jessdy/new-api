package model

import (
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	AgentStatusPending  = "pending"
	AgentStatusEnabled  = "enabled"
	AgentStatusDisabled = "disabled"
	AgentStatusOverdue  = "overdue"

	AgentSettlementBillStatusOpen     = "open"
	AgentSettlementBillStatusInvoiced = "invoiced"
	AgentSettlementBillStatusPaid     = "paid"

	AgentMemberRoleUser  = "user"
	AgentMemberRoleSales = "sales"
)

// Agent is a reseller profile bound to a login user.
type Agent struct {
	Id             int    `json:"id"`
	UserId         int    `json:"user_id" gorm:"uniqueIndex;not null"`
	Name           string `json:"name" gorm:"type:varchar(128);not null"`
	InviteCode     string `json:"invite_code" gorm:"type:varchar(32);uniqueIndex;not null"`
	Status         string `json:"status" gorm:"type:varchar(32);index;not null;default:pending"`
	CreditLimit    int64  `json:"credit_limit" gorm:"type:bigint;not null;default:0"`
	SettlementDebt int64  `json:"settlement_debt" gorm:"type:bigint;not null;default:0"`
	PaymentConfig  string `json:"-" gorm:"type:text;column:payment_config"` // encrypted JSON
	PricingConfig  string `json:"-" gorm:"type:text;column:pricing_config"` // agent group pricing extras
	CreatedAt      int64  `json:"created_at" gorm:"bigint;autoCreateTime"`
	UpdatedAt      int64  `json:"updated_at" gorm:"bigint;autoUpdateTime"`
}

type AgentChannel struct {
	AgentId   int   `json:"agent_id" gorm:"primaryKey;autoIncrement:false"`
	ChannelId int   `json:"channel_id" gorm:"primaryKey;autoIncrement:false;index"`
	CreatedAt int64 `json:"created_at" gorm:"bigint;autoCreateTime"`
}

type AgentGroup struct {
	Id          int     `json:"id"`
	AgentId     int     `json:"agent_id" gorm:"uniqueIndex:uk_agent_group_name;index;not null"`
	Name        string  `json:"name" gorm:"type:varchar(64);uniqueIndex:uk_agent_group_name;not null"`
	Ratio       float64 `json:"ratio" gorm:"type:decimal(16,8);not null;default:1"`
	TopupRatio  float64 `json:"topup_ratio" gorm:"type:decimal(16,8);not null;default:1"`
	Description string  `json:"description" gorm:"type:varchar(255);default:''"`
	Selectable  bool    `json:"selectable"`
	Enabled     bool    `json:"enabled"`
	IsDefault   bool    `json:"is_default"`
	CreatedAt   int64   `json:"created_at" gorm:"bigint;autoCreateTime"`
	UpdatedAt   int64   `json:"updated_at" gorm:"bigint;autoUpdateTime"`
}

type AgentModelPrice struct {
	AgentId       int     `json:"agent_id" gorm:"primaryKey;autoIncrement:false"`
	Model         string  `json:"model" gorm:"type:varchar(255);primaryKey;autoIncrement:false"`
	DiscountRatio float64 `json:"discount_ratio" gorm:"type:decimal(16,8);not null;default:1"` // retail multiplier for end users
	CostRatio     float64 `json:"cost_ratio" gorm:"type:decimal(16,8);not null;default:1"`     // platform→agent settlement / upstream cost
	UpdatedAt     int64   `json:"updated_at" gorm:"bigint;autoUpdateTime"`
}

// AgentModelListItem is one model available through the agent's selected channels.
type AgentModelListItem struct {
	ModelName       string   `json:"model_name"`
	ChannelIds      []int    `json:"channel_ids"`
	ChannelNames    []string `json:"channel_names"`
	CostRatio       float64  `json:"cost_ratio"`
	HasCostOverride bool     `json:"has_cost_override"`
	DiscountRatio   float64  `json:"discount_ratio"`
}

type AgentSettlementBill struct {
	Id            int    `json:"id"`
	AgentId       int    `json:"agent_id" gorm:"index;not null"`
	PeriodStart   int64  `json:"period_start" gorm:"bigint;not null"`
	PeriodEnd     int64  `json:"period_end" gorm:"bigint;not null"`
	PlatformQuota int64  `json:"platform_quota" gorm:"type:bigint;not null;default:0"`
	Status        string `json:"status" gorm:"type:varchar(32);index;not null;default:open"`
	PaidAt        int64  `json:"paid_at" gorm:"bigint;default:0"`
	CreatedAt     int64  `json:"created_at" gorm:"bigint;autoCreateTime"`
	UpdatedAt     int64  `json:"updated_at" gorm:"bigint;autoUpdateTime"`
}

var (
	ErrAgentNotFound       = errors.New("agent not found")
	ErrAgentNotEnabled     = errors.New("agent is not enabled")
	ErrAgentCreditExceeded = errors.New("agent credit limit exceeded")
	ErrAgentInviteInvalid  = errors.New("invalid agent invite code")
)

func (a *Agent) IsRequestAllowed() bool {
	if a == nil {
		return false
	}
	if a.Status != AgentStatusEnabled {
		return false
	}
	if a.CreditLimit > 0 && a.SettlementDebt >= a.CreditLimit {
		return false
	}
	return true
}

func GetAgentById(id int) (*Agent, error) {
	if id <= 0 {
		return nil, ErrAgentNotFound
	}
	var agent Agent
	err := DB.First(&agent, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrAgentNotFound
	}
	return &agent, err
}

func GetAgentByUserId(userId int) (*Agent, error) {
	if userId <= 0 {
		return nil, ErrAgentNotFound
	}
	var agent Agent
	err := DB.Where("user_id = ?", userId).First(&agent).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrAgentNotFound
	}
	return &agent, err
}

func GetAgentByInviteCode(code string) (*Agent, error) {
	code = strings.ToLower(strings.TrimSpace(code))
	if code == "" {
		return nil, ErrAgentInviteInvalid
	}
	var agent Agent
	err := DB.Where("LOWER(invite_code) = ?", code).First(&agent).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrAgentInviteInvalid
	}
	return &agent, err
}

// RegistrationInviteBinding is the agent/inviter attachment derived from a
// sign-up affiliate or reseller invite code.
type RegistrationInviteBinding struct {
	InviterId  int
	AgentId    int
	AgentGroup string
}

func NormalizeAgentMemberRole(role string) string {
	if strings.ToLower(strings.TrimSpace(role)) == AgentMemberRoleSales {
		return AgentMemberRoleSales
	}
	return AgentMemberRoleUser
}

func ResolveRegistrationInvite(code string) RegistrationInviteBinding {
	code = strings.TrimSpace(code)
	if code == "" {
		return RegistrationInviteBinding{}
	}
	inviterId, _ := GetUserIdByAffCode(code)
	if agent, err := GetAgentByInviteCode(code); err == nil && agent != nil && agent.Status == AgentStatusEnabled {
		group, _ := GetAgentDefaultGroupName(agent.Id)
		return RegistrationInviteBinding{InviterId: inviterId, AgentId: agent.Id, AgentGroup: group}
	}
	if inviterId <= 0 {
		return RegistrationInviteBinding{}
	}
	if agent, err := GetAgentByUserId(inviterId); err == nil && agent != nil && agent.Status == AgentStatusEnabled {
		group, _ := GetAgentDefaultGroupName(agent.Id)
		return RegistrationInviteBinding{InviterId: inviterId, AgentId: agent.Id, AgentGroup: group}
	}
	inviter, err := GetUserById(inviterId, false)
	if err != nil || inviter == nil || inviter.AgentId <= 0 {
		return RegistrationInviteBinding{InviterId: inviterId}
	}
	agent, err := GetAgentById(inviter.AgentId)
	if err != nil || agent == nil || agent.Status != AgentStatusEnabled {
		return RegistrationInviteBinding{InviterId: inviterId}
	}
	group, _ := GetAgentDefaultGroupName(agent.Id)
	return RegistrationInviteBinding{InviterId: inviterId, AgentId: agent.Id, AgentGroup: group}
}

func AttachInvitedUsersToAgent(agent *Agent) error {
	if agent == nil || agent.Id <= 0 || agent.UserId <= 0 {
		return nil
	}
	if _, err := attachUnboundInvitees(agent.Id, []int{agent.UserId}); err != nil {
		return err
	}
	for range 16 {
		var memberIds []int
		if err := DB.Model(&User{}).Where("agent_id = ?", agent.Id).Pluck("id", &memberIds).Error; err != nil {
			return err
		}
		if len(memberIds) == 0 {
			return nil
		}
		attached, err := attachUnboundInvitees(agent.Id, memberIds)
		if err != nil {
			return err
		}
		if attached == 0 {
			return nil
		}
	}
	return nil
}

func attachUnboundInvitees(agentId int, inviterIds []int) (int64, error) {
	if agentId <= 0 || len(inviterIds) == 0 {
		return 0, nil
	}
	var ids []int
	if err := DB.Model(&User{}).
		Where("inviter_id IN ? AND agent_id = ?", inviterIds, 0).
		Pluck("id", &ids).Error; err != nil {
		return 0, err
	}
	if len(ids) == 0 {
		return 0, nil
	}
	result := DB.Model(&User{}).Where("id IN ? AND agent_id = ?", ids, 0).Updates(map[string]any{
		"agent_id":          agentId,
		"agent_member_role": AgentMemberRoleUser,
	})
	if result.Error != nil {
		return 0, result.Error
	}
	for _, id := range ids {
		_ = invalidateUserCache(id)
	}
	return result.RowsAffected, nil
}

// BindUserToInviteAgent attaches a previously unbound user to the agent of
// their invite tree. Sales and end-user invitees both stay under that agent.
func BindUserToInviteAgent(user *User) error {
	if user == nil || user.Id <= 0 || user.AgentId > 0 || user.InviterId <= 0 {
		return nil
	}
	currentId := user.InviterId
	for range 16 {
		if currentId <= 0 {
			return nil
		}
		if agent, err := GetAgentByUserId(currentId); err == nil && agent != nil && agent.Status == AgentStatusEnabled {
			return persistInviteAgentBinding(user, agent)
		}
		inviter, err := GetUserById(currentId, false)
		if err != nil || inviter == nil {
			return nil
		}
		if inviter.AgentId > 0 {
			agent, err := GetAgentById(inviter.AgentId)
			if err != nil || agent == nil || agent.Status != AgentStatusEnabled {
				return nil
			}
			return persistInviteAgentBinding(user, agent)
		}
		currentId = inviter.InviterId
	}
	return nil
}

func persistInviteAgentBinding(user *User, agent *Agent) error {
	fields := map[string]any{"agent_id": agent.Id}
	if strings.TrimSpace(user.AgentMemberRole) == "" {
		fields["agent_member_role"] = AgentMemberRoleUser
	}
	if err := DB.Model(&User{}).Where("id = ? AND agent_id = ?", user.Id, 0).Updates(fields).Error; err != nil {
		return err
	}
	user.AgentId = agent.Id
	if strings.TrimSpace(user.AgentMemberRole) == "" {
		user.AgentMemberRole = AgentMemberRoleUser
	}
	return invalidateUserCache(user.Id)
}

type AgentManagedUser struct {
	Id              int    `json:"id"`
	Username        string `json:"username"`
	DisplayName     string `json:"display_name"`
	Status          int    `json:"status"`
	Group           string `json:"group"`
	Quota           int    `json:"quota"`
	UsedQuota       int    `json:"used_quota"`
	AffCode         string `json:"aff_code"`
	InviterId       int    `json:"inviter_id"`
	InviterUsername string `json:"inviter_username"`
	AgentMemberRole string `json:"agent_member_role"`
	CreatedAt       int64  `json:"created_at"`
}

func ListUsersByAgentId(agentId int, offset, limit int) ([]AgentManagedUser, int64, error) {
	agent, err := GetAgentById(agentId)
	if err != nil {
		return nil, 0, err
	}
	if err := AttachInvitedUsersToAgent(agent); err != nil {
		return nil, 0, err
	}
	var total int64
	if err := DB.Model(&User{}).Where("agent_id = ?", agentId).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var users []User
	err = DB.Model(&User{}).
		Select("id", "username", "display_name", "status", "group", "quota", "used_quota", "aff_code", "inviter_id", "agent_member_role", "created_at").
		Where("agent_id = ?", agentId).
		Order("id desc").Offset(offset).Limit(limit).Find(&users).Error
	if err != nil {
		return nil, 0, err
	}
	inviterIds := make([]int, 0)
	seen := map[int]struct{}{}
	for i := range users {
		inviterId := users[i].InviterId
		if inviterId <= 0 {
			continue
		}
		if _, ok := seen[inviterId]; ok {
			continue
		}
		seen[inviterId] = struct{}{}
		inviterIds = append(inviterIds, inviterId)
	}
	names := map[int]string{}
	if len(inviterIds) > 0 {
		var inviters []User
		if err := DB.Select("id", "username").Where("id IN ?", inviterIds).Find(&inviters).Error; err != nil {
			return nil, 0, err
		}
		for i := range inviters {
			names[inviters[i].Id] = inviters[i].Username
		}
	}
	items := make([]AgentManagedUser, 0, len(users))
	for i := range users {
		items = append(items, AgentManagedUser{
			Id:              users[i].Id,
			Username:        users[i].Username,
			DisplayName:     users[i].DisplayName,
			Status:          users[i].Status,
			Group:           users[i].Group,
			Quota:           users[i].Quota,
			UsedQuota:       users[i].UsedQuota,
			AffCode:         users[i].AffCode,
			InviterId:       users[i].InviterId,
			InviterUsername: names[users[i].InviterId],
			AgentMemberRole: NormalizeAgentMemberRole(users[i].AgentMemberRole),
			CreatedAt:       users[i].CreatedAt,
		})
	}
	return items, total, nil
}

func GetEnabledAgentById(id int) (*Agent, error) {
	agent, err := GetAgentById(id)
	if err != nil {
		return nil, err
	}
	if !agent.IsRequestAllowed() {
		if agent.Status != AgentStatusEnabled {
			return nil, ErrAgentNotEnabled
		}
		return nil, ErrAgentCreditExceeded
	}
	return agent, nil
}

func CreateAgent(agent *Agent) error {
	if agent == nil {
		return errors.New("agent is nil")
	}
	agent.InviteCode = strings.ToLower(strings.TrimSpace(agent.InviteCode))
	if agent.InviteCode == "" {
		agent.InviteCode = strings.ToLower(common.GetRandomString(8))
	}
	if agent.Status == "" {
		agent.Status = AgentStatusPending
	}
	return DB.Create(agent).Error
}

func UpdateAgentFields(id int, fields map[string]any) error {
	if id <= 0 {
		return ErrAgentNotFound
	}
	result := DB.Model(&Agent{}).Where("id = ?", id).Updates(fields)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrAgentNotFound
	}
	return nil
}

func ListAgents(offset, limit int, status string, userId int) ([]*Agent, int64, error) {
	query := DB.Model(&Agent{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if userId > 0 {
		query = query.Where("user_id = ?", userId)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var agents []*Agent
	err := query.Order("id desc").Offset(offset).Limit(limit).Find(&agents).Error
	return agents, total, err
}

func ListAgentChannelIds(agentId int) ([]int, error) {
	var ids []int
	err := DB.Model(&AgentChannel{}).Where("agent_id = ?", agentId).Pluck("channel_id", &ids).Error
	return ids, err
}

func ReplaceAgentChannels(agentId int, channelIds []int) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("agent_id = ?", agentId).Delete(&AgentChannel{}).Error; err != nil {
			return err
		}
		if len(channelIds) == 0 {
			return nil
		}
		seen := make(map[int]struct{}, len(channelIds))
		rows := make([]AgentChannel, 0, len(channelIds))
		now := time.Now().Unix()
		for _, channelId := range channelIds {
			if channelId <= 0 {
				continue
			}
			if _, ok := seen[channelId]; ok {
				continue
			}
			seen[channelId] = struct{}{}
			rows = append(rows, AgentChannel{AgentId: agentId, ChannelId: channelId, CreatedAt: now})
		}
		if len(rows) == 0 {
			return nil
		}
		return tx.Create(&rows).Error
	})
}

func ListAgentGroups(agentId int) ([]*AgentGroup, error) {
	var groups []*AgentGroup
	err := DB.Where("agent_id = ?", agentId).Order("id asc").Find(&groups).Error
	return groups, err
}

func GetAgentGroup(agentId int, name string) (*AgentGroup, error) {
	var group AgentGroup
	err := DB.Where("agent_id = ? AND name = ?", agentId, name).First(&group).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, gorm.ErrRecordNotFound
	}
	return &group, err
}

func UpsertAgentGroup(group *AgentGroup) error {
	if group == nil {
		return errors.New("agent group is nil")
	}
	group.Name = strings.TrimSpace(group.Name)
	if group.Name == "" {
		return errors.New("group name is required")
	}
	if group.Ratio <= 0 {
		return errors.New("group ratio must be positive")
	}
	if group.TopupRatio <= 0 {
		group.TopupRatio = 1
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "agent_id"}, {Name: "name"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"ratio", "topup_ratio", "description", "selectable", "enabled", "is_default", "updated_at",
		}),
	}).Create(group).Error
}

func DeleteAgentGroup(agentId int, name string) error {
	return DB.Where("agent_id = ? AND name = ?", agentId, name).Delete(&AgentGroup{}).Error
}

func GetAgentDefaultGroupName(agentId int) (string, error) {
	var group AgentGroup
	err := DB.Where("agent_id = ? AND enabled = ? AND is_default = ?", agentId, true, true).First(&group).Error
	if err == nil {
		return group.Name, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return "", err
	}
	err = DB.Where("agent_id = ? AND enabled = ?", agentId, true).Order("id asc").First(&group).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "default", nil
	}
	return group.Name, err
}

func ListAgentModelPrices(agentId int) ([]*AgentModelPrice, error) {
	var prices []*AgentModelPrice
	err := DB.Where("agent_id = ?", agentId).Order("model asc").Find(&prices).Error
	return prices, err
}

func GetAgentModelDiscount(agentId int, modelName string) (float64, bool) {
	if agentId <= 0 || modelName == "" {
		return 1, false
	}
	var price AgentModelPrice
	err := DB.Where("agent_id = ? AND model = ?", agentId, modelName).First(&price).Error
	if err != nil || price.DiscountRatio <= 0 {
		return 1, false
	}
	return price.DiscountRatio, true
}

func GetAgentModelCostRatio(agentId int, modelName string) (float64, bool) {
	if agentId <= 0 || modelName == "" {
		return 1, false
	}
	var price AgentModelPrice
	err := DB.Where("agent_id = ? AND model = ?", agentId, modelName).First(&price).Error
	if err != nil || price.CostRatio <= 0 {
		return 1, false
	}
	return price.CostRatio, true
}

func UpsertAgentModelPrice(price *AgentModelPrice) error {
	if price == nil {
		return errors.New("agent model price is nil")
	}
	price.Model = strings.TrimSpace(price.Model)
	if price.Model == "" {
		return errors.New("model is required")
	}
	if price.DiscountRatio <= 0 {
		return errors.New("discount ratio must be positive")
	}
	if price.CostRatio <= 0 {
		price.CostRatio = 1
	}
	return DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "agent_id"}, {Name: "model"}},
		DoUpdates: clause.AssignmentColumns([]string{"discount_ratio", "updated_at"}),
	}).Create(price).Error
}

// UpsertAgentModelCost sets the platform→agent settlement cost ratio for a model.
func UpsertAgentModelCost(agentId int, modelName string, costRatio float64) error {
	modelName = strings.TrimSpace(modelName)
	if agentId <= 0 {
		return errors.New("agent id is required")
	}
	if modelName == "" {
		return errors.New("model is required")
	}
	if costRatio <= 0 {
		return errors.New("cost ratio must be positive")
	}
	price := &AgentModelPrice{
		AgentId:       agentId,
		Model:         modelName,
		DiscountRatio: 1,
		CostRatio:     costRatio,
	}
	return DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "agent_id"}, {Name: "model"}},
		DoUpdates: clause.AssignmentColumns([]string{"cost_ratio", "updated_at"}),
	}).Create(price).Error
}

func DeleteAgentModelPrice(agentId int, modelName string) error {
	return DB.Where("agent_id = ? AND model = ?", agentId, modelName).Delete(&AgentModelPrice{}).Error
}

// ListAgentModels returns distinct models from the agent's selected channels,
// merged with any stored cost/discount overrides.
func ListAgentModels(agentId int) ([]AgentModelListItem, error) {
	if agentId <= 0 {
		return nil, errors.New("agent id is required")
	}
	channelIds, err := ListAgentChannelIds(agentId)
	if err != nil {
		return nil, err
	}
	type modelAgg struct {
		channelIds   []int
		channelNames []string
	}
	byModel := make(map[string]*modelAgg)
	for _, channelId := range channelIds {
		ch, err := GetChannelById(channelId, false)
		if err != nil || ch == nil {
			continue
		}
		for _, modelName := range ch.GetModels() {
			modelName = strings.TrimSpace(modelName)
			if modelName == "" {
				continue
			}
			agg := byModel[modelName]
			if agg == nil {
				agg = &modelAgg{}
				byModel[modelName] = agg
			}
			agg.channelIds = append(agg.channelIds, ch.Id)
			agg.channelNames = append(agg.channelNames, ch.Name)
		}
	}
	prices, err := ListAgentModelPrices(agentId)
	if err != nil {
		return nil, err
	}
	priceByModel := make(map[string]*AgentModelPrice, len(prices))
	for _, price := range prices {
		if price == nil {
			continue
		}
		priceByModel[price.Model] = price
		if _, ok := byModel[price.Model]; !ok {
			byModel[price.Model] = &modelAgg{}
		}
	}
	names := make([]string, 0, len(byModel))
	for name := range byModel {
		names = append(names, name)
	}
	slices.Sort(names)
	items := make([]AgentModelListItem, 0, len(names))
	for _, name := range names {
		agg := byModel[name]
		item := AgentModelListItem{
			ModelName:     name,
			ChannelIds:    agg.channelIds,
			ChannelNames:  agg.channelNames,
			CostRatio:     1,
			DiscountRatio: 1,
		}
		if price, ok := priceByModel[name]; ok {
			if price.CostRatio > 0 {
				item.CostRatio = price.CostRatio
			}
			item.HasCostOverride = price.CostRatio > 0 && price.CostRatio != 1
			if price.DiscountRatio > 0 {
				item.DiscountRatio = price.DiscountRatio
			}
		}
		items = append(items, item)
	}
	return items, nil
}

func AccrueAgentSettlementDebt(agentId int, platformQuota int64) error {
	if agentId <= 0 || platformQuota <= 0 {
		return nil
	}
	return DB.Model(&Agent{}).Where("id = ?", agentId).
		UpdateColumn("settlement_debt", gorm.Expr("settlement_debt + ?", platformQuota)).Error
}

func ReduceAgentSettlementDebt(agentId int, amount int64) error {
	if agentId <= 0 || amount <= 0 {
		return nil
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var agent Agent
		if err := lockForUpdate(tx).First(&agent, agentId).Error; err != nil {
			return err
		}
		next := agent.SettlementDebt - amount
		if next < 0 {
			next = 0
		}
		return tx.Model(&Agent{}).Where("id = ?", agentId).Update("settlement_debt", next).Error
	})
}

func CreateAgentSettlementBill(bill *AgentSettlementBill) error {
	if bill == nil {
		return errors.New("bill is nil")
	}
	if bill.Status == "" {
		bill.Status = AgentSettlementBillStatusOpen
	}
	return DB.Create(bill).Error
}

func ListAgentSettlementBills(agentId int, offset, limit int) ([]*AgentSettlementBill, int64, error) {
	query := DB.Model(&AgentSettlementBill{})
	if agentId > 0 {
		query = query.Where("agent_id = ?", agentId)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var bills []*AgentSettlementBill
	err := query.Order("id desc").Offset(offset).Limit(limit).Find(&bills).Error
	return bills, total, err
}

func MarkAgentSettlementBillPaid(billId int) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var bill AgentSettlementBill
		if err := lockForUpdate(tx).First(&bill, billId).Error; err != nil {
			return err
		}
		if bill.Status == AgentSettlementBillStatusPaid {
			return nil
		}
		if err := tx.Model(&AgentSettlementBill{}).Where("id = ?", billId).Updates(map[string]any{
			"status":  AgentSettlementBillStatusPaid,
			"paid_at": time.Now().Unix(),
		}).Error; err != nil {
			return err
		}
		var agent Agent
		if err := lockForUpdate(tx).First(&agent, bill.AgentId).Error; err != nil {
			return err
		}
		next := agent.SettlementDebt - bill.PlatformQuota
		if next < 0 {
			next = 0
		}
		return tx.Model(&Agent{}).Where("id = ?", bill.AgentId).Update("settlement_debt", next).Error
	})
}

func EnsureAgentDefaultGroup(agentId int) error {
	_, err := GetAgentGroup(agentId, "default")
	if err == nil {
		return nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	return UpsertAgentGroup(&AgentGroup{
		AgentId:     agentId,
		Name:        "default",
		Ratio:       1,
		TopupRatio:  1,
		Description: "Default",
		Selectable:  true,
		Enabled:     true,
		IsDefault:   true,
	})
}

func AgentPublicSummary(agent *Agent) map[string]any {
	if agent == nil {
		return nil
	}
	return map[string]any{
		"id":              agent.Id,
		"user_id":         agent.UserId,
		"name":            agent.Name,
		"invite_code":     agent.InviteCode,
		"status":          agent.Status,
		"credit_limit":    agent.CreditLimit,
		"settlement_debt": agent.SettlementDebt,
		"request_allowed": agent.IsRequestAllowed(),
		"created_at":      agent.CreatedAt,
		"updated_at":      agent.UpdatedAt,
	}
}

func FormatAgentCreditError(agent *Agent) string {
	if agent == nil {
		return ErrAgentNotFound.Error()
	}
	if agent.Status != AgentStatusEnabled {
		return fmt.Sprintf("agent status is %s", agent.Status)
	}
	return ErrAgentCreditExceeded.Error()
}
