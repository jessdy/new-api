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
	assert.Equal(t, AlipayGatewaySandbox, uri)
	assert.Equal(t, "alipay.trade.page.pay", params["method"])
	assert.NotEmpty(t, params["sign"])
	require.NoError(t, client.VerifyNotification(params))

	params["sign"] = "invalid"
	assert.Error(t, client.VerifyNotification(params))
}

func TestAlipayNotifyGuards(t *testing.T) {
	assert.Equal(t, "1.00", AlipayAmountString(1))
	assert.Equal(t, "12.30", AlipayAmountString(12.3))
	assert.True(t, IsAlipayTradeSuccess("TRADE_SUCCESS"))
	assert.True(t, IsAlipayTradeSuccess("TRADE_FINISHED"))
	assert.False(t, IsAlipayTradeSuccess("WAIT_BUYER_PAY"))

	_, err := NewAlipayClient("", "x", "y", false)
	assert.Error(t, err)
}
