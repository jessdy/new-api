package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// AgentPaymentConfig is the decrypted merchant configuration for an agent.
type AgentPaymentConfig struct {
	EpayEnabled bool                `json:"epay_enabled"`
	PayAddress  string              `json:"pay_address"`
	EpayId      string              `json:"epay_id"`
	EpayKey     string              `json:"epay_key"`
	PayMethods  []map[string]string `json:"pay_methods"`

	StripeEnabled       bool    `json:"stripe_enabled"`
	StripeApiSecret     string  `json:"stripe_api_secret"`
	StripeWebhookSecret string  `json:"stripe_webhook_secret"`
	StripePriceId       string  `json:"stripe_price_id"`
	StripeUnitPrice     float64 `json:"stripe_unit_price"`
	StripeMinTopUp      int     `json:"stripe_min_topup"`
}

func (a *Agent) GetPaymentConfig() (AgentPaymentConfig, error) {
	cfg := AgentPaymentConfig{}
	if a == nil || a.PaymentConfig == "" {
		return cfg, nil
	}
	plain, err := common.DecryptPayload(a.PaymentConfig)
	if err != nil {
		return cfg, err
	}
	if plain == "" {
		return cfg, nil
	}
	if err := common.Unmarshal([]byte(plain), &cfg); err != nil {
		return cfg, err
	}
	return cfg, nil
}

func (a *Agent) SetPaymentConfig(cfg AgentPaymentConfig) error {
	if a == nil {
		return ErrAgentNotFound
	}
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
	return map[string]any{
		"epay_enabled":              cfg.EpayEnabled,
		"pay_address":               cfg.PayAddress,
		"epay_id":                   maskSecret(cfg.EpayId),
		"epay_key_set":              cfg.EpayKey != "",
		"pay_methods":               methods,
		"stripe_enabled":            cfg.StripeEnabled,
		"stripe_api_secret_set":     cfg.StripeApiSecret != "",
		"stripe_webhook_secret_set": cfg.StripeWebhookSecret != "",
		"stripe_price_id":           cfg.StripePriceId,
		"stripe_unit_price":         cfg.StripeUnitPrice,
		"stripe_min_topup":          cfg.StripeMinTopUp,
	}
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
