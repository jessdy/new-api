package controller

import (
	"github.com/Calcium-Ion/go-epay/epay"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

type resolvedEpayGateway struct {
	Client  *epay.Client
	Methods []map[string]string
	AgentId int
}

type resolvedStripeGateway struct {
	ApiSecret     string
	WebhookSecret string
	PriceId       string
	UnitPrice     float64
	MinTopUp      int
	Enabled       bool
	AgentId       int
}

func resolveUserAgentId(userId int) int {
	user, err := model.GetUserById(userId, false)
	if err != nil || user == nil {
		return 0
	}
	return user.AgentId
}

func resolveEpayGatewayForUser(userId int) (*resolvedEpayGateway, error) {
	agentId := resolveUserAgentId(userId)
	if agentId > 0 {
		agent, err := model.GetAgentById(agentId)
		if err != nil {
			return nil, err
		}
		cfg, err := agent.GetPaymentConfig()
		if err != nil {
			return nil, err
		}
		if !cfg.EpayEnabled || cfg.PayAddress == "" || cfg.EpayId == "" || cfg.EpayKey == "" {
			return nil, nil
		}
		client, err := epay.NewClient(&epay.Config{
			PartnerID: cfg.EpayId,
			Key:       cfg.EpayKey,
		}, cfg.PayAddress)
		if err != nil {
			return nil, err
		}
		methods := cfg.PayMethods
		if methods == nil {
			methods = []map[string]string{}
		}
		return &resolvedEpayGateway{Client: client, Methods: methods, AgentId: agentId}, nil
	}
	client := GetEpayClient()
	if client == nil {
		return nil, nil
	}
	return &resolvedEpayGateway{
		Client:  client,
		Methods: operation_setting.PayMethods,
		AgentId: 0,
	}, nil
}

func resolveEpayGatewayForTopUp(topUp *model.TopUp) (*resolvedEpayGateway, error) {
	if topUp == nil {
		return nil, nil
	}
	if topUp.AgentId > 0 {
		agent, err := model.GetAgentById(topUp.AgentId)
		if err != nil {
			return nil, err
		}
		cfg, err := agent.GetPaymentConfig()
		if err != nil {
			return nil, err
		}
		if cfg.PayAddress == "" || cfg.EpayId == "" || cfg.EpayKey == "" {
			return nil, nil
		}
		client, err := epay.NewClient(&epay.Config{
			PartnerID: cfg.EpayId,
			Key:       cfg.EpayKey,
		}, cfg.PayAddress)
		if err != nil {
			return nil, err
		}
		return &resolvedEpayGateway{Client: client, AgentId: topUp.AgentId}, nil
	}
	client := GetEpayClient()
	if client == nil {
		return nil, nil
	}
	return &resolvedEpayGateway{Client: client, AgentId: 0}, nil
}

func resolveStripeGatewayForUser(userId int) (*resolvedStripeGateway, error) {
	agentId := resolveUserAgentId(userId)
	if agentId > 0 {
		agent, err := model.GetAgentById(agentId)
		if err != nil {
			return nil, err
		}
		cfg, err := agent.GetPaymentConfig()
		if err != nil {
			return nil, err
		}
		if !cfg.StripeEnabled {
			return &resolvedStripeGateway{Enabled: false, AgentId: agentId}, nil
		}
		return &resolvedStripeGateway{
			ApiSecret:     cfg.StripeApiSecret,
			WebhookSecret: cfg.StripeWebhookSecret,
			PriceId:       cfg.StripePriceId,
			UnitPrice:     cfg.StripeUnitPrice,
			MinTopUp:      cfg.StripeMinTopUp,
			Enabled:       cfg.StripeApiSecret != "" && cfg.StripeWebhookSecret != "" && cfg.StripePriceId != "",
			AgentId:       agentId,
		}, nil
	}
	return &resolvedStripeGateway{
		ApiSecret:     setting.StripeApiSecret,
		WebhookSecret: setting.StripeWebhookSecret,
		PriceId:       setting.StripePriceId,
		UnitPrice:     setting.StripeUnitPrice,
		MinTopUp:      setting.StripeMinTopUp,
		Enabled:       isStripeTopUpEnabled(),
		AgentId:       0,
	}, nil
}

func resolveStripeGatewayForAgent(agentId int) (*resolvedStripeGateway, error) {
	if agentId <= 0 {
		return &resolvedStripeGateway{
			ApiSecret:     setting.StripeApiSecret,
			WebhookSecret: setting.StripeWebhookSecret,
			PriceId:       setting.StripePriceId,
			UnitPrice:     setting.StripeUnitPrice,
			MinTopUp:      setting.StripeMinTopUp,
			Enabled:       isStripeTopUpEnabled(),
			AgentId:       0,
		}, nil
	}
	agent, err := model.GetAgentById(agentId)
	if err != nil {
		return nil, err
	}
	cfg, err := agent.GetPaymentConfig()
	if err != nil {
		return nil, err
	}
	return &resolvedStripeGateway{
		ApiSecret:     cfg.StripeApiSecret,
		WebhookSecret: cfg.StripeWebhookSecret,
		PriceId:       cfg.StripePriceId,
		UnitPrice:     cfg.StripeUnitPrice,
		MinTopUp:      cfg.StripeMinTopUp,
		Enabled:       cfg.StripeEnabled && cfg.StripeApiSecret != "" && cfg.StripeWebhookSecret != "",
		AgentId:       agentId,
	}, nil
}

func getPayMoneyForUser(userId int, amount int64, group string) float64 {
	agentId := resolveUserAgentId(userId)
	money := getPayMoney(amount, group)
	if agentId <= 0 {
		return money
	}
	ratio := service.GetAgentTopupRatio(agentId, group)
	if ratio <= 0 {
		ratio = 1
	}
	return money * ratio
}
