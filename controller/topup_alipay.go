package controller

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

func RequestAlipayPay(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}
	var req EpayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.PaymentMethod != "" && req.PaymentMethod != model.PaymentMethodAlipayNative {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付方式不存在"})
		return
	}

	id := c.GetInt("id")
	minTopup := getMinTopupForUser(id)
	if req.Amount < minTopup {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", minTopup)})
		return
	}
	if rejectInvalidTopUpQuota(c, id, req.Amount) {
		return
	}

	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	payMoney := getPayMoneyForUser(id, req.Amount, group)
	if payMoney < 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	gateway, err := resolveAlipayGatewayForUser(id)
	if err != nil || gateway == nil || !gateway.Enabled || gateway.Client == nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "当前未配置支付宝"})
		return
	}

	callBackAddress := service.GetCallbackAddress()
	if agent, agentErr := model.GetAgentById(gateway.AgentId); agentErr == nil && agent != nil {
		if cfg, cfgErr := agent.GetPaymentConfig(); cfgErr == nil && cfg.CustomCallbackAddress != "" {
			callBackAddress = strings.TrimRight(cfg.CustomCallbackAddress, "/")
		}
	}
	notifyURL := strings.TrimRight(callBackAddress, "/") + "/api/alipay/notify"
	returnURL := paymentReturnPath("/wallet?pay=success")
	tradeNo := fmt.Sprintf("USR%dNO%s%d", id, common.GetRandomString(6), time.Now().Unix())
	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromInt(amount)
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		amount = dAmount.Div(dQuotaPerUnit).IntPart()
	}

	userAgent := strings.ToLower(c.GetHeader("User-Agent"))
	uri, params, err := gateway.Client.BuildPagePay(service.AlipayPagePayRequest{
		OutTradeNo:  tradeNo,
		Subject:     fmt.Sprintf("TUC%d", req.Amount),
		TotalAmount: service.AlipayAmountString(payMoney),
		NotifyURL:   notifyURL,
		ReturnURL:   returnURL,
		Mobile: strings.Contains(userAgent, "mobile") ||
			strings.Contains(userAgent, "android") ||
			strings.Contains(userAgent, "iphone") ||
			strings.Contains(userAgent, "ipad") ||
			strings.Contains(userAgent, "micromessenger"),
	})
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝 拉起支付失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodAlipayNative,
		PaymentProvider: model.PaymentProviderAlipay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
		AgentId:         gateway.AgentId,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝 创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝 充值订单创建成功 user_id=%d trade_no=%s amount=%d money=%.2f", id, tradeNo, req.Amount, payMoney))
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": params, "url": uri})
}

func AlipayNotify(c *gin.Context) {
	if err := c.Request.ParseForm(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝 webhook 表单解析失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	params := service.AlipayFormValues(c.Request.PostForm)
	if len(params) == 0 {
		params = service.AlipayFormValues(url.Values(c.Request.URL.Query()))
	}
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝 webhook 收到请求 path=%q client_ip=%s params=%q", c.Request.RequestURI, c.ClientIP(), common.GetJsonString(map[string]string{
		"out_trade_no": params["out_trade_no"],
		"trade_status": params["trade_status"],
		"app_id":       params["app_id"],
		"total_amount": params["total_amount"],
	})))

	tradeNo := params["out_trade_no"]
	if tradeNo == "" {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 webhook 订单不存在 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	if topUp.PaymentProvider != model.PaymentProviderAlipay {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 webhook 网关不匹配 trade_no=%s payment_provider=%s", tradeNo, topUp.PaymentProvider))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	gateway, err := resolveAlipayGatewayForTopUp(topUp)
	if err != nil || gateway == nil || gateway.Client == nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝 webhook 网关未配置 trade_no=%s error=%v", tradeNo, err))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	if err := gateway.Client.VerifyNotification(params); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 webhook 验签失败 trade_no=%s error=%q", tradeNo, err.Error()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	if !service.IsAlipayTradeSuccess(params["trade_status"]) {
		_, _ = c.Writer.Write([]byte("success"))
		return
	}
	if params["total_amount"] != service.AlipayAmountString(topUp.Money) {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("支付宝 webhook 金额不匹配 trade_no=%s notify=%s order=%.2f", tradeNo, params["total_amount"], topUp.Money))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	alreadyDone, err := model.RechargeAlipay(tradeNo, model.PaymentMethodAlipayNative, c.ClientIP())
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("支付宝 webhook 入账失败 trade_no=%s error=%q", tradeNo, err.Error()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	if alreadyDone {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("支付宝 webhook 重复通知 trade_no=%s", tradeNo))
	}
	_, _ = c.Writer.Write([]byte("success"))
}
