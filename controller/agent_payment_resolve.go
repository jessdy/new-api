package controller

import (
	"github.com/Calcium-Ion/go-epay/epay"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/shopspring/decimal"
)

type resolvedEpayGateway struct {
	Client                *epay.Client
	Methods               []map[string]string
	CustomCallbackAddress string
	AgentId               int
}

type resolvedStripeGateway struct {
	ApiSecret             string
	WebhookSecret         string
	PriceId               string
	UnitPrice             float64
	MinTopUp              int
	PromotionCodesEnabled bool
	Enabled               bool
	AgentId               int
}

type resolvedAgentTopUpPricing struct {
	Price          float64
	MinTopUp       int
	AmountOptions  []int
	AmountDiscount map[int]float64
	AgentId        int
}

func resolveUserAgentId(userId int) int {
	user, err := model.GetUserById(userId, false)
	if err != nil || user == nil {
		return 0
	}
	if user.AgentId > 0 {
		return user.AgentId
	}
	if err := model.BindUserToInviteAgent(user); err != nil {
		return 0
	}
	return user.AgentId
}

func resolveAgentTopUpPricing(userId int) resolvedAgentTopUpPricing {
	agentId := resolveUserAgentId(userId)
	if agentId <= 0 {
		return resolvedAgentTopUpPricing{
			Price:          operation_setting.Price,
			MinTopUp:       operation_setting.MinTopUp,
			AmountOptions:  operation_setting.GetPaymentSetting().AmountOptions,
			AmountDiscount: operation_setting.GetPaymentSetting().AmountDiscount,
			AgentId:        0,
		}
	}
	agent, err := model.GetAgentById(agentId)
	if err != nil || agent == nil {
		return resolvedAgentTopUpPricing{AgentId: agentId}
	}
	cfg, err := agent.GetPaymentConfig()
	if err != nil {
		return resolvedAgentTopUpPricing{AgentId: agentId}
	}
	price := cfg.Price
	if price <= 0 {
		price = operation_setting.Price
	}
	minTopUp := cfg.MinTopUp
	if minTopUp <= 0 {
		minTopUp = operation_setting.MinTopUp
	}
	options := cfg.AmountOptions
	if len(options) == 0 {
		options = operation_setting.GetPaymentSetting().AmountOptions
	}
	discount := cfg.AmountDiscount
	if len(discount) == 0 {
		discount = operation_setting.GetPaymentSetting().AmountDiscount
	}
	return resolvedAgentTopUpPricing{
		Price:          price,
		MinTopUp:       minTopUp,
		AmountOptions:  options,
		AmountDiscount: discount,
		AgentId:        agentId,
	}
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
		return &resolvedEpayGateway{
			Client:                client,
			Methods:               methods,
			CustomCallbackAddress: cfg.CustomCallbackAddress,
			AgentId:               agentId,
		}, nil
	}
	client := GetEpayClient()
	if client == nil {
		return nil, nil
	}
	return &resolvedEpayGateway{
		Client:                client,
		Methods:               operation_setting.PayMethods,
		CustomCallbackAddress: operation_setting.CustomCallbackAddress,
		AgentId:               0,
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
		return &resolvedEpayGateway{
			Client:                client,
			CustomCallbackAddress: cfg.CustomCallbackAddress,
			AgentId:               topUp.AgentId,
		}, nil
	}
	client := GetEpayClient()
	if client == nil {
		return nil, nil
	}
	return &resolvedEpayGateway{
		Client:                client,
		CustomCallbackAddress: operation_setting.CustomCallbackAddress,
		AgentId:               0,
	}, nil
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
			ApiSecret:             cfg.StripeApiSecret,
			WebhookSecret:         cfg.StripeWebhookSecret,
			PriceId:               cfg.StripePriceId,
			UnitPrice:             cfg.StripeUnitPrice,
			MinTopUp:              cfg.StripeMinTopUp,
			PromotionCodesEnabled: cfg.StripePromotionCodesEnabled,
			Enabled:               cfg.StripeApiSecret != "" && cfg.StripeWebhookSecret != "" && cfg.StripePriceId != "",
			AgentId:               agentId,
		}, nil
	}
	return &resolvedStripeGateway{
		ApiSecret:             setting.StripeApiSecret,
		WebhookSecret:         setting.StripeWebhookSecret,
		PriceId:               setting.StripePriceId,
		UnitPrice:             setting.StripeUnitPrice,
		MinTopUp:              setting.StripeMinTopUp,
		PromotionCodesEnabled: setting.StripePromotionCodesEnabled,
		Enabled:               isStripeTopUpEnabled(),
		AgentId:               0,
	}, nil
}

func resolveStripeGatewayForAgent(agentId int) (*resolvedStripeGateway, error) {
	if agentId <= 0 {
		return &resolvedStripeGateway{
			ApiSecret:             setting.StripeApiSecret,
			WebhookSecret:         setting.StripeWebhookSecret,
			PriceId:               setting.StripePriceId,
			UnitPrice:             setting.StripeUnitPrice,
			MinTopUp:              setting.StripeMinTopUp,
			PromotionCodesEnabled: setting.StripePromotionCodesEnabled,
			Enabled:               isStripeTopUpEnabled(),
			AgentId:               0,
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
		ApiSecret:             cfg.StripeApiSecret,
		WebhookSecret:         cfg.StripeWebhookSecret,
		PriceId:               cfg.StripePriceId,
		UnitPrice:             cfg.StripeUnitPrice,
		MinTopUp:              cfg.StripeMinTopUp,
		PromotionCodesEnabled: cfg.StripePromotionCodesEnabled,
		Enabled:               cfg.StripeEnabled && cfg.StripeApiSecret != "" && cfg.StripeWebhookSecret != "",
		AgentId:               agentId,
	}, nil
}

func getPayMoneyForUser(userId int, amount int64, group string) float64 {
	pricing := resolveAgentTopUpPricing(userId)
	money := getPayMoneyWithPricing(amount, group, pricing.Price, pricing.AmountDiscount)
	if pricing.AgentId <= 0 {
		return money
	}
	ratio := service.GetAgentTopupRatio(pricing.AgentId, group)
	if ratio <= 0 {
		ratio = 1
	}
	return money * ratio
}

func getPayMoneyWithPricing(amount int64, group string, price float64, amountDiscount map[int]float64) float64 {
	dAmount := decimal.NewFromInt(amount)
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		dAmount = dAmount.Div(dQuotaPerUnit)
	}

	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}

	discount := 1.0
	if ds, ok := amountDiscount[int(amount)]; ok && ds > 0 {
		discount = ds
	}
	if price <= 0 {
		price = operation_setting.Price
	}

	payMoney := dAmount.
		Mul(decimal.NewFromFloat(price)).
		Mul(decimal.NewFromFloat(topupGroupRatio)).
		Mul(decimal.NewFromFloat(discount))
	return payMoney.InexactFloat64()
}

func getMinTopupForUser(userId int) int64 {
	pricing := resolveAgentTopUpPricing(userId)
	minTopup := pricing.MinTopUp
	if minTopup <= 0 {
		minTopup = operation_setting.MinTopUp
	}
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dMinTopup := decimal.NewFromInt(int64(minTopup))
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		quota, err := common.WalletQuotaFromDecimalStrict(dMinTopup.Mul(dQuotaPerUnit))
		if err != nil {
			return common.MaxWalletQuota
		}
		minTopup = quota
	}
	return int64(minTopup)
}
