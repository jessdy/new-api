package model

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// AgentPaymentConfig is the decrypted merchant configuration for an agent.
// It mirrors the platform Epay/Stripe/general top-up gateway settings and is
// owned by the agent after configuration.
type AgentPaymentConfig struct {
	// General top-up pricing (agent-owned; used for the agent's users).
	Price          float64         `json:"price"`
	MinTopUp       int             `json:"min_topup"`
	AmountOptions  []int           `json:"amount_options"`
	AmountDiscount map[int]float64 `json:"amount_discount"`

	EpayEnabled           bool                `json:"epay_enabled"`
	PayAddress            string              `json:"pay_address"`
	CustomCallbackAddress string              `json:"custom_callback_address"`
	EpayId                string              `json:"epay_id"`
	EpayKey               string              `json:"epay_key"`
	PayMethods            []map[string]string `json:"pay_methods"`

	StripeEnabled               bool    `json:"stripe_enabled"`
	StripeApiSecret             string  `json:"stripe_api_secret"`
	StripeWebhookSecret         string  `json:"stripe_webhook_secret"`
	StripePriceId               string  `json:"stripe_price_id"`
	StripeUnitPrice             float64 `json:"stripe_unit_price"`
	StripeMinTopUp              int     `json:"stripe_min_topup"`
	StripePromotionCodesEnabled bool    `json:"stripe_promotion_codes_enabled"`

	AlipayEnabled    bool   `json:"alipay_enabled"`
	AlipayAppId      string `json:"alipay_app_id"`
	AlipayPrivateKey string `json:"alipay_private_key"`
	AlipayPublicKey  string `json:"alipay_public_key"`
	AlipaySandbox    bool   `json:"alipay_sandbox"`
}

func (a *Agent) GetPaymentConfig() (AgentPaymentConfig, error) {
	cfg := emptyAgentPaymentConfig()
	if a == nil || a.PaymentConfig == "" {
		return cfg, nil
	}
	plain, err := common.DecryptPayload(a.PaymentConfig)
	if err != nil {
		if parseAgentPaymentJSON(a.PaymentConfig, &cfg) {
			return cfg, nil
		}
		common.SysError(fmt.Sprintf("agent payment_config decrypt failed agent_id=%d payload_len=%d error=%q", a.Id, len(a.PaymentConfig), err.Error()))
		return emptyAgentPaymentConfig(), nil
	}
	if plain == "" {
		return cfg, nil
	}
	if err := common.Unmarshal([]byte(plain), &cfg); err != nil {
		return emptyAgentPaymentConfig(), err
	}
	normalizeAgentPaymentConfig(&cfg)
	return cfg, nil
}

func emptyAgentPaymentConfig() AgentPaymentConfig {
	return AgentPaymentConfig{
		AmountOptions:  []int{},
		AmountDiscount: map[int]float64{},
		PayMethods:     []map[string]string{},
	}
}

func normalizeAgentPaymentConfig(cfg *AgentPaymentConfig) {
	if cfg.AmountOptions == nil {
		cfg.AmountOptions = []int{}
	}
	if cfg.AmountDiscount == nil {
		cfg.AmountDiscount = map[int]float64{}
	}
	if cfg.PayMethods == nil {
		cfg.PayMethods = []map[string]string{}
	}
}

func parseAgentPaymentJSON(raw string, cfg *AgentPaymentConfig) bool {
	raw = strings.TrimSpace(raw)
	if !strings.HasPrefix(raw, "{") {
		return false
	}
	if err := common.Unmarshal([]byte(raw), cfg); err != nil {
		return false
	}
	normalizeAgentPaymentConfig(cfg)
	return true
}

func (a *Agent) SetPaymentConfig(cfg AgentPaymentConfig) error {
	if a == nil {
		return ErrAgentNotFound
	}
	normalizeAgentPaymentConfig(&cfg)
	raw, err := common.Marshal(cfg)
	if err != nil {
		return err
	}
	sealed, err := common.EncryptPayload(string(raw))
	if err != nil {
		return err
	}
	a.PaymentConfig = sealed
	return UpdateAgentFields(a.Id, map[string]any{"payment_config": sealed})
}

func (cfg AgentPaymentConfig) PublicView() map[string]any {
	methods := cfg.PayMethods
	if methods == nil {
		methods = []map[string]string{}
	}
	options := cfg.AmountOptions
	if options == nil {
		options = []int{}
	}
	discount := cfg.AmountDiscount
	if discount == nil {
		discount = map[int]float64{}
	}
	return map[string]any{
		"price":                          cfg.Price,
		"min_topup":                      cfg.MinTopUp,
		"amount_options":                 options,
		"amount_discount":                discount,
		"epay_enabled":                   cfg.EpayEnabled,
		"pay_address":                    cfg.PayAddress,
		"custom_callback_address":        cfg.CustomCallbackAddress,
		"epay_id":                        maskSecret(cfg.EpayId),
		"epay_id_set":                    cfg.EpayId != "",
		"epay_key_set":                   cfg.EpayKey != "",
		"pay_methods":                    methods,
		"stripe_enabled":                 cfg.StripeEnabled,
		"stripe_api_secret_set":          cfg.StripeApiSecret != "",
		"stripe_webhook_secret_set":      cfg.StripeWebhookSecret != "",
		"stripe_price_id":                cfg.StripePriceId,
		"stripe_unit_price":              cfg.StripeUnitPrice,
		"stripe_min_topup":               cfg.StripeMinTopUp,
		"stripe_promotion_codes_enabled": cfg.StripePromotionCodesEnabled,
		"alipay_enabled":                 cfg.AlipayEnabled,
		"alipay_app_id":                  cfg.AlipayAppId,
		"alipay_private_key_set":         cfg.AlipayPrivateKey != "",
		"alipay_public_key_set":          cfg.AlipayPublicKey != "",
		"alipay_sandbox":                 cfg.AlipaySandbox,
	}
}

func (cfg AgentPaymentConfig) AlipayConfigured() bool {
	return cfg.AlipayEnabled &&
		strings.TrimSpace(cfg.AlipayAppId) != "" &&
		strings.TrimSpace(cfg.AlipayPrivateKey) != "" &&
		strings.TrimSpace(cfg.AlipayPublicKey) != ""
}

func maskSecret(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if len(value) <= 4 {
		return "****"
	}
	return value[:2] + "****" + value[len(value)-2:]
}
