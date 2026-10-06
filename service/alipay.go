package service

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	AlipayGatewayProd    = "https://openapi.alipay.com/gateway.do"
	AlipayGatewaySandbox = "https://openapi-sandbox.dl.alipaydev.com/gateway.do"
	alipayPagePayMethod  = "alipay.trade.page.pay"
	alipayWapPayMethod   = "alipay.trade.wap.pay"
	alipayPageProduct    = "FAST_INSTANT_TRADE_PAY"
	alipayWapProduct     = "QUICK_WAP_WAY"
)

type AlipayClient struct {
	AppId      string
	PrivateKey *rsa.PrivateKey
	PublicKey  *rsa.PublicKey
	Sandbox    bool
}

type AlipayPagePayRequest struct {
	OutTradeNo  string
	Subject     string
	TotalAmount string
	NotifyURL   string
	ReturnURL   string
	Mobile      bool
}

func NewAlipayClient(appId, privateKeyPEM, publicKeyPEM string, sandbox bool) (*AlipayClient, error) {
	appId = normalizeAlipayAppId(appId)
	if appId == "" {
		return nil, errors.New("alipay app id is required")
	}
	if !isAlipayAppId(appId) {
		return nil, fmt.Errorf("alipay app id is invalid: %q", appId)
	}
	privateKey, err := ParseRSAPrivateKey(privateKeyPEM)
	if err != nil {
		return nil, fmt.Errorf("alipay private key: %w", err)
	}
	publicKey, err := ParseRSAPublicKey(publicKeyPEM)
	if err != nil {
		return nil, fmt.Errorf("alipay public key: %w", err)
	}
	return &AlipayClient{
		AppId:      appId,
		PrivateKey: privateKey,
		PublicKey:  publicKey,
		Sandbox:    sandbox,
	}, nil
}

func (c *AlipayClient) Gateway() string {
	if c.Sandbox {
		return AlipayGatewaySandbox
	}
	return AlipayGatewayProd
}

func (c *AlipayClient) BuildPagePay(req AlipayPagePayRequest) (string, map[string]string, error) {
	if c == nil || c.PrivateKey == nil {
		return "", nil, errors.New("alipay client is not configured")
	}
	method := alipayPagePayMethod
	product := alipayPageProduct
	if req.Mobile {
		method = alipayWapPayMethod
		product = alipayWapProduct
	}
	biz, err := common.Marshal(map[string]string{
		"out_trade_no": req.OutTradeNo,
		"total_amount": req.TotalAmount,
		"subject":      req.Subject,
		"product_code": product,
	})
	if err != nil {
		return "", nil, err
	}
	params := map[string]string{
		"app_id":      c.AppId,
		"method":      method,
		"format":      "JSON",
		"charset":     "utf-8",
		"sign_type":   "RSA2",
		"timestamp":   alipayTimestamp(),
		"version":     "1.0",
		"biz_content": string(biz),
	}
	if req.NotifyURL != "" {
		params["notify_url"] = req.NotifyURL
	}
	if req.ReturnURL != "" {
		params["return_url"] = req.ReturnURL
	}
	sign, err := SignAlipayParams(params, c.PrivateKey)
	if err != nil {
		return "", nil, err
	}
	params["sign"] = sign
	if err := verifyAlipaySignature(params, &c.PrivateKey.PublicKey, false); err != nil {
		return "", nil, fmt.Errorf("alipay request signature self-check failed: %w", err)
	}
	// Official page/wap pay posts to gateway.do?charset=utf-8. Posting to the
	// bare gateway omits the charset hint and Alipay reports invalid-app-id.
	return c.Gateway() + "?charset=" + url.QueryEscape("utf-8"), params, nil
}

func alipayTimestamp() string {
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		loc = time.FixedZone("CST", 8*3600)
	}
	return time.Now().In(loc).Format("2006-01-02 15:04:05")
}

func normalizeAlipayAppId(raw string) string {
	raw = strings.TrimSpace(strings.Trim(raw, "\"'"))
	raw = strings.TrimPrefix(raw, "\ufeff")
	return strings.Map(func(r rune) rune {
		if r == ' ' || r == '\n' || r == '\t' || r == '\r' {
			return -1
		}
		return r
	}, raw)
}

func isAlipayAppId(appId string) bool {
	if len(appId) < 8 || len(appId) > 32 {
		return false
	}
	for _, r := range appId {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func (c *AlipayClient) VerifyNotification(params map[string]string) error {
	if c == nil || c.PublicKey == nil {
		return errors.New("alipay client is not configured")
	}
	if params["app_id"] != "" && params["app_id"] != c.AppId {
		return errors.New("alipay app id mismatch")
	}
	return VerifyAlipayParams(params, c.PublicKey)
}

func AlipayAmountString(money float64) string {
	return fmt.Sprintf("%.2f", money)
}

func IsAlipayTradeSuccess(status string) bool {
	return status == "TRADE_SUCCESS" || status == "TRADE_FINISHED"
}

func SignAlipayParams(params map[string]string, key *rsa.PrivateKey) (string, error) {
	if key == nil {
		return "", errors.New("alipay private key is required")
	}
	hashed := sha256.Sum256([]byte(alipayJoinParams(params, false)))
	sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, hashed[:])
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(sig), nil
}

func VerifyAlipayParams(params map[string]string, key *rsa.PublicKey) error {
	return verifyAlipaySignature(params, key, true)
}

func verifyAlipaySignature(params map[string]string, key *rsa.PublicKey, skipSignType bool) error {
	if key == nil {
		return errors.New("alipay public key is required")
	}
	sign := strings.TrimSpace(params["sign"])
	if sign == "" {
		return errors.New("alipay sign is missing")
	}
	raw, err := base64.StdEncoding.DecodeString(sign)
	if err != nil {
		return err
	}
	hashed := sha256.Sum256([]byte(alipayJoinParams(params, skipSignType)))
	return rsa.VerifyPKCS1v15(key, crypto.SHA256, hashed[:], raw)
}

func alipayJoinParams(params map[string]string, skipSignType bool) string {
	keys := make([]string, 0, len(params))
	for key, value := range params {
		if key == "sign" || value == "" {
			continue
		}
		if skipSignType && key == "sign_type" {
			continue
		}
		keys = append(keys, key)
	}
	sort.Strings(keys)
	var builder strings.Builder
	for i, key := range keys {
		if i > 0 {
			builder.WriteByte('&')
		}
		builder.WriteString(key)
		builder.WriteByte('=')
		builder.WriteString(params[key])
	}
	return builder.String()
}

func ParseRSAPrivateKey(raw string) (*rsa.PrivateKey, error) {
	der, err := decodePEMOrBase64(raw)
	if err != nil {
		return nil, err
	}
	if key, err := x509.ParsePKCS1PrivateKey(der); err == nil {
		return key, nil
	}
	parsed, err := x509.ParsePKCS8PrivateKey(der)
	if err != nil {
		return nil, err
	}
	key, ok := parsed.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("not an RSA private key")
	}
	return key, nil
}

func EncodeAlipayAppPublicKey(privateKeyPEM string) (string, error) {
	key, err := ParseRSAPrivateKey(privateKeyPEM)
	if err != nil {
		return "", err
	}
	der, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(der), nil
}

func ParseRSAPublicKey(raw string) (*rsa.PublicKey, error) {
	der, err := decodePEMOrBase64(raw)
	if err != nil {
		return nil, err
	}
	if key, err := x509.ParsePKCS1PublicKey(der); err == nil {
		return key, nil
	}
	parsed, err := x509.ParsePKIXPublicKey(der)
	if err != nil {
		return nil, err
	}
	key, ok := parsed.(*rsa.PublicKey)
	if !ok {
		return nil, errors.New("not an RSA public key")
	}
	return key, nil
}

func decodePEMOrBase64(raw string) ([]byte, error) {
	raw = strings.TrimSpace(strings.ReplaceAll(raw, "\r\n", "\n"))
	if raw == "" {
		return nil, errors.New("empty key")
	}
	if block, _ := pem.Decode([]byte(raw)); block != nil {
		return block.Bytes, nil
	}
	compact := strings.Map(func(r rune) rune {
		if r == ' ' || r == '\n' || r == '\t' {
			return -1
		}
		return r
	}, raw)
	return base64.StdEncoding.DecodeString(compact)
}

func AlipayFormValues(params url.Values) map[string]string {
	out := make(map[string]string, len(params))
	for key := range params {
		out[key] = params.Get(key)
	}
	return out
}
