package service

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAlipaySignAndVerifyRoundTrip(t *testing.T) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	privatePEM := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(privateKey),
	})
	publicDER, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	require.NoError(t, err)
	publicPEM := pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: publicDER})

	client, err := NewAlipayClient("2021000000000001", string(privatePEM), string(publicPEM), true)
	require.NoError(t, err)
	assert.Equal(t, AlipayGatewaySandbox, client.Gateway())

	uri, params, err := client.BuildPagePay(AlipayPagePayRequest{
		OutTradeNo:  "USR1NOTEST1",
		Subject:     "TUC10",
		TotalAmount: "1.00",
		NotifyURL:   "https://example.com/api/alipay/notify",
		ReturnURL:   "https://example.com/wallet?pay=success",
	})
	require.NoError(t, err)
	assert.Equal(t, AlipayGatewaySandbox+"?charset=utf-8", uri)
	assert.Equal(t, "2021000000000001", params["app_id"])
	assert.Equal(t, "utf-8", params["charset"])
	assert.Equal(t, "alipay.trade.page.pay", params["method"])
	assert.NotEmpty(t, params["sign"])
	require.NoError(t, verifyAlipaySignature(params, client.PublicKey, false))

	appPublic, err := EncodeAlipayAppPublicKey(string(privatePEM))
	require.NoError(t, err)
	parsedAppPublic, err := ParseRSAPublicKey(appPublic)
	require.NoError(t, err)
	require.NoError(t, verifyAlipaySignature(params, parsedAppPublic, false))

	params["sign"] = "invalid"
	assert.Error(t, verifyAlipaySignature(params, client.PublicKey, false))
}

func TestAlipayRequestSignContentMatchesGateway(t *testing.T) {
	params := map[string]string{
		"app_id":      "9021000168694495",
		"biz_content": `{"out_trade_no":"USR4NOC5wNqC1791043102","product_code":"FAST_INSTANT_TRADE_PAY","subject":"TUC10","total_amount":"10.00"}`,
		"charset":     "utf-8",
		"format":      "JSON",
		"method":      "alipay.trade.page.pay",
		"notify_url":  "https://xtfac.com/api/alipay/notify",
		"return_url":  "https://xtfac.com/wallet?pay=success",
		"sign_type":   "RSA2",
		"timestamp":   "2026-10-03 23:58:22",
		"version":     "1.0",
		"sign":        "ignored",
	}
	assert.Equal(t,
		`app_id=9021000168694495&biz_content={"out_trade_no":"USR4NOC5wNqC1791043102","product_code":"FAST_INSTANT_TRADE_PAY","subject":"TUC10","total_amount":"10.00"}&charset=utf-8&format=JSON&method=alipay.trade.page.pay&notify_url=https://xtfac.com/api/alipay/notify&return_url=https://xtfac.com/wallet?pay=success&sign_type=RSA2&timestamp=2026-10-03 23:58:22&version=1.0`,
		alipayJoinParams(params, false),
	)
	assert.NotContains(t, alipayJoinParams(params, true), "sign_type=")
}

func TestAlipayNotifyGuards(t *testing.T) {
	assert.Equal(t, "1.00", AlipayAmountString(1))
	assert.Equal(t, "12.30", AlipayAmountString(12.3))
	assert.True(t, IsAlipayTradeSuccess("TRADE_SUCCESS"))
	assert.True(t, IsAlipayTradeSuccess("TRADE_FINISHED"))
	assert.False(t, IsAlipayTradeSuccess("WAIT_BUYER_PAY"))

	_, err := NewAlipayClient("", "x", "y", false)
	assert.Error(t, err)
	_, err = NewAlipayClient("not-an-app-id", "x", "y", false)
	assert.Error(t, err)
}

func TestNormalizeAlipayAppId(t *testing.T) {
	assert.Equal(t, "2021000000000001", normalizeAlipayAppId("  \"2021000000000001\" \n"))
	assert.True(t, isAlipayAppId("2021000000000001"))
	assert.False(t, isAlipayAppId("app_2021"))
}
