package helper

import (
	"fmt"
	"maps"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/reasoning"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	hostreasoning "github.com/QuantumNous/new-api/setting/reasoning"
	hosttypes "github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func modelPriceNotConfiguredError(modelName string, userId int) error {
	if model.IsAdmin(userId) {
		return fmt.Errorf(
			"模型 %s 的价格未配置。请前往「系统设置 → 运营设置」开启自用模式，或在「系统设置 → 分组与模型定价设置」中为该模型配置价格；"+
				"Model %s price not configured. Go to System Settings → Operation Settings to enable self-use mode, or configure the model price in System Settings → Group & Model Pricing.",
			modelName, modelName,
		)
	}
	return fmt.Errorf(
		"模型 %s 的价格尚未由管理员配置，暂时无法使用，请联系站点管理员开启该模型；"+
			"Model %s has not been priced by the administrator yet. Please contact the site administrator to enable this model.",
		modelName, modelName,
	)
}

// https://docs.claude.com/en/docs/build-with-claude/prompt-caching#1-hour-cache-duration
const claudeCacheCreation1hMultiplier = 6 / 3.75

// defaultTieredPreConsumeMaxTokens is the fallback completion-token estimate
// used for tiered expression pre-consume when the client omits max_tokens, so
// the pre-consumed quota still reflects a plausible output cost in paid groups.
const defaultTieredPreConsumeMaxTokens = 8192

func PrepareEffectivePricing(info *relaycommon.RelayInfo, pricingModelName string) (model.EffectiveModelPricing, error) {
	result := model.EffectiveModelPricing{
		Source:        model.PricingSourcePlatform,
		Allowed:       true,
		DiscountRatio: 1,
	}
	if info == nil || info.UserId <= 0 {
		return result, nil
	}
	if info.RetailPricingResolved && info.RetailPricingResolvedModel == pricingModelName {
		result.Pricing = maps.Clone(info.RetailPricing)
		result.Source = info.RetailPricingSource
		result.Allowed = info.RetailPricingAllowed
		result.DiscountRatio = info.RetailPricingDiscount
		return result, nil
	}

	user, err := model.GetUserCache(info.UserId)
	if err != nil {
		return result, err
	}
	result, err = model.ResolveEffectiveModelPricing(user, info.OriginModelName, pricingModelName)
	if err != nil {
		return result, err
	}
	info.RetailPricing = maps.Clone(result.Pricing)
	info.RetailPricingSource = result.Source
	info.RetailPricingResolvedModel = pricingModelName
	info.RetailPricingResolved = true
	info.RetailPricingAllowed = result.Allowed
	info.RetailPricingDiscount = result.DiscountRatio
	return result, nil
}

func EffectiveBillingConfig(info *relaycommon.RelayInfo, pricingModelName string) (model.EffectiveModelPricing, string, string, error) {
	effective, err := PrepareEffectivePricing(info, pricingModelName)
	if err != nil || !effective.Allowed {
		return effective, "", "", err
	}
	mode := billing_setting.GetBillingMode(pricingModelName)
	if configuredMode, ok := effective.Pricing["billing_setting.billing_mode"].(string); ok {
		mode = configuredMode
	} else if len(effective.Pricing) > 0 &&
		(userPricingHas(effective.Pricing, "ModelPrice") || userPricingHas(effective.Pricing, "ModelRatio")) {
		mode = ""
	}
	expression := ""
	if mode == billing_setting.BillingModeTieredExpr {
		expression, _ = effective.Pricing["billing_setting.billing_expr"].(string)
		if strings.TrimSpace(expression) == "" {
			expression, _ = billing_setting.GetBillingExpr(pricingModelName)
		}
	}
	return effective, mode, expression, nil
}

// HandleGroupRatio checks for "auto_group" in the context and updates the group ratio and relayInfo.UsingGroup if present
func HandleGroupRatio(ctx *gin.Context, relayInfo *relaycommon.RelayInfo) hosttypes.GroupRatioInfo {
	groupRatioInfo := hosttypes.GroupRatioInfo{
		GroupRatio:        1.0, // default ratio
		GroupSpecialRatio: -1,
	}

	// check auto group
	autoGroup, exists := ctx.Get("auto_group")
	if exists {
		logger.LogDebug(ctx, "final group: %s", autoGroup)
		relayInfo.UsingGroup = autoGroup.(string)
	}

	agentId := 0
	if relayInfo != nil {
		agentId = relayInfo.AgentId
	}
	if agentId <= 0 && ctx != nil {
		agentId = common.GetContextKeyInt(ctx, constant.ContextKeyUserAgentId)
		if relayInfo != nil {
			relayInfo.AgentId = agentId
		}
	}

	if agentId > 0 {
		userGroup := ""
		if relayInfo != nil {
			userGroup = relayInfo.UserGroup
		}
		if ratio, ok := service.GetAgentGroupGroupRatio(agentId, userGroup, relayInfo.UsingGroup); ok {
			groupRatioInfo.GroupRatio = ratio
			groupRatioInfo.HasSpecialRatio = true
			groupRatioInfo.GroupSpecialRatio = ratio
		} else if ratio, ok := service.GetAgentGroupRatio(agentId, relayInfo.UsingGroup); ok {
			groupRatioInfo.GroupRatio = ratio
		} else {
			groupRatioInfo.GroupRatio = 1
		}
		discount := 1.0
		modelName := ""
		userId := 0
		if relayInfo != nil {
			modelName = relayInfo.GetBillingModelName()
			if modelName == "" {
				modelName = relayInfo.OriginModelName
			}
			userId = relayInfo.UserId
		}
		if relayInfo != nil && relayInfo.RetailPricingResolved {
			discount = relayInfo.RetailPricingDiscount
		} else if d, ok := model.GetAgentModelDiscount(agentId, modelName); ok {
			if _, hasUserPricing := model.GetAgentUserModelPricing(userId, modelName); !hasUserPricing {
				discount = d
			}
		}
		if relayInfo != nil {
			relayInfo.AgentDiscountRatio = discount
		}
		groupRatioInfo.GroupRatio = groupRatioInfo.GroupRatio * discount
		return groupRatioInfo
	}

	// check user group special ratio
	userGroupRatio, ok := ratio_setting.GetGroupGroupRatio(relayInfo.UserGroup, relayInfo.UsingGroup)
	if ok {
		// user group special ratio
		groupRatioInfo.GroupSpecialRatio = userGroupRatio
		groupRatioInfo.GroupRatio = userGroupRatio
		groupRatioInfo.HasSpecialRatio = true
	} else {
		// normal group ratio
		groupRatioInfo.GroupRatio = ratio_setting.GetGroupRatio(relayInfo.UsingGroup)
	}

	return groupRatioInfo
}

func ModelPriceHelper(c *gin.Context, info *relaycommon.RelayInfo, promptTokens int, meta *types.TokenCountMeta) (hosttypes.PriceData, error) {
	if info != nil {
		if matched := resolveBillingModelName(info.GetOriginModelName()); matched != "" && matched != info.OriginModelName {
			info.BillingModelName = matched
		}
	}
	billingModelName := info.GetBillingModelName()
	effective, billingMode, exprStr, err := EffectiveBillingConfig(info, billingModelName)
	if err != nil {
		return hosttypes.PriceData{}, err
	}
	if !effective.Allowed {
		return hosttypes.PriceData{}, modelPriceNotConfiguredError(billingModelName, info.UserId)
	}
	if err := PrepareAgentCostPricing(c, info, billingModelName, promptTokens, meta); err != nil {
		return hosttypes.PriceData{}, err
	}
	modelPrice, usePrice := ratio_setting.GetModelPrice(billingModelName, false)
	effectivePricing := effective.Pricing
	hasPricingOverride := len(effectivePricing) > 0
	if hasPricingOverride {
		if price, ok := userPricingFloat(effectivePricing, "ModelPrice"); ok {
			modelPrice = price
			usePrice = true
		} else if _, hasRatio := userPricingFloat(effectivePricing, "ModelRatio"); hasRatio {
			usePrice = false
		}
	}

	groupRatioInfo := HandleGroupRatio(c, info)

	if billingMode == billing_setting.BillingModeTieredExpr {
		if strings.TrimSpace(exprStr) == "" {
			return hosttypes.PriceData{}, fmt.Errorf("model %s is configured as tiered_expr but has no billing expression", billingModelName)
		}
		return modelPriceHelperTiered(c, info, billingModelName, exprStr, promptTokens, meta, groupRatioInfo)
	}

	var preConsumedQuota int
	var modelRatio float64
	var completionRatio float64
	var cacheRatio float64
	var imageRatio float64
	var cacheCreationRatio float64
	var cacheCreationRatio5m float64
	var cacheCreationRatio1h float64
	var audioRatio float64
	var audioCompletionRatio float64
	var freeModel bool
	if !usePrice {
		preConsumedTokens := common.Max(promptTokens, common.PreConsumedQuota)
		if meta.MaxTokens != 0 {
			preConsumedTokens += meta.MaxTokens
		}
		var success bool
		var matchName string
		modelRatio, success, matchName = ratio_setting.GetModelRatio(billingModelName)
		if hasPricingOverride {
			if ratio, ok := userPricingFloat(effectivePricing, "ModelRatio"); ok {
				modelRatio = ratio
				success = true
				matchName = billingModelName
			}
		}
		if !success {
			acceptUnsetRatio := false
			if info.UserSetting.AcceptUnsetRatioModel {
				acceptUnsetRatio = true
			}
			if !acceptUnsetRatio {
				return hosttypes.PriceData{}, modelPriceNotConfiguredError(matchName, info.UserId)
			}
		}
		completionRatio = ratio_setting.GetCompletionRatio(billingModelName)
		cacheRatio, _ = ratio_setting.GetCacheRatio(billingModelName)
		cacheCreationRatio, _ = ratio_setting.GetCreateCacheRatio(billingModelName)
		imageRatio, _ = ratio_setting.GetImageRatio(billingModelName)
		audioRatio = ratio_setting.GetAudioRatio(billingModelName)
		audioCompletionRatio = ratio_setting.GetAudioCompletionRatio(billingModelName)
		if hasPricingOverride {
			if v, ok := userPricingFloat(effectivePricing, "CompletionRatio"); ok {
				completionRatio = v
			}
			if v, ok := userPricingFloat(effectivePricing, "CacheRatio"); ok {
				cacheRatio = v
			}
			if v, ok := userPricingFloat(effectivePricing, "CreateCacheRatio"); ok {
				cacheCreationRatio = v
			}
			if v, ok := userPricingFloat(effectivePricing, "ImageRatio"); ok {
				imageRatio = v
			}
			if v, ok := userPricingFloat(effectivePricing, "AudioRatio"); ok {
				audioRatio = v
			}
			if v, ok := userPricingFloat(effectivePricing, "AudioCompletionRatio"); ok {
				audioCompletionRatio = v
			}
		}
		cacheCreationRatio5m = cacheCreationRatio
		// 固定1h和5min缓存写入价格的比例
		cacheCreationRatio1h = cacheCreationRatio * claudeCacheCreation1hMultiplier
		ratio := modelRatio * groupRatioInfo.GroupRatio
		quota, err := common.QuotaFromFloatStrict(float64(preConsumedTokens) * ratio)
		if err != nil {
			return hosttypes.PriceData{}, err
		}
		preConsumedQuota = quota
	} else {
		if meta.ImagePriceRatio != 0 {
			modelPrice = modelPrice * meta.ImagePriceRatio
		}
	}

	// check if free model pre-consume is disabled
	if !operation_setting.GetQuotaSetting().EnableFreeModelPreConsume {
		// if model price or ratio is 0, do not pre-consume quota
		if groupRatioInfo.GroupRatio == 0 {
			preConsumedQuota = 0
			freeModel = true
		} else if usePrice {
			if modelPrice == 0 {
				preConsumedQuota = 0
				freeModel = true
			}
		} else {
			if modelRatio == 0 {
				preConsumedQuota = 0
				freeModel = true
			}
		}
	}

	priceData := hosttypes.PriceData{
		FreeModel:            freeModel,
		ModelPrice:           modelPrice,
		ModelRatio:           modelRatio,
		CompletionRatio:      completionRatio,
		GroupRatioInfo:       groupRatioInfo,
		UsePrice:             usePrice,
		CacheRatio:           cacheRatio,
		ImageRatio:           imageRatio,
		AudioRatio:           audioRatio,
		AudioCompletionRatio: audioCompletionRatio,
		CacheCreationRatio:   cacheCreationRatio,
		CacheCreation5mRatio: cacheCreationRatio5m,
		CacheCreation1hRatio: cacheCreationRatio1h,
		QuotaToPreConsume:    preConsumedQuota,
	}
	if usePrice {
		for name, ratio := range meta.BillingRatios {
			priceData.AddOtherRatio(name, ratio)
		}
		quotaToPreConsume := priceData.ApplyOtherRatiosToFloat(modelPrice * common.QuotaPerUnit * groupRatioInfo.GroupRatio)
		quota, err := common.QuotaFromFloatStrict(quotaToPreConsume)
		if err != nil {
			return hosttypes.PriceData{}, err
		}
		priceData.QuotaToPreConsume = quota
	}

	if common.DebugEnabled {
		logger.LogDebug(c, "model_price_helper result: %s", priceData.ToSetting())
	}
	info.PriceData = priceData
	return priceData, nil
}

// ModelPriceHelperPerCall 按次/按量计费的 PriceHelper (MJ、Task)
func ModelPriceHelperPerCall(c *gin.Context, info *relaycommon.RelayInfo) (hosttypes.PriceData, error) {
	pricingModelName := info.GetBillingModelName()
	effective, err := PrepareEffectivePricing(info, pricingModelName)
	if err != nil {
		return hosttypes.PriceData{}, err
	}
	if !effective.Allowed {
		return hosttypes.PriceData{}, modelPriceNotConfiguredError(pricingModelName, info.UserId)
	}
	if err := PrepareAgentCostPricing(c, info, pricingModelName, 0, nil); err != nil {
		return hosttypes.PriceData{}, err
	}
	groupRatioInfo := HandleGroupRatio(c, info)

	modelPrice, success := ratio_setting.GetModelPrice(pricingModelName, true)
	usePrice := success
	var modelRatio float64
	if price, ok := userPricingFloat(effective.Pricing, "ModelPrice"); ok {
		modelPrice = price
		success = true
		usePrice = true
	}

	if !success {
		defaultPrice, ok := ratio_setting.GetDefaultModelPriceMap()[pricingModelName]
		if ok {
			modelPrice = defaultPrice
			usePrice = true
		} else {
			var ratioSuccess bool
			var matchName string
			modelRatio, ratioSuccess, matchName = ratio_setting.GetModelRatio(pricingModelName)
			acceptUnsetRatio := false
			if info.UserSetting.AcceptUnsetRatioModel {
				acceptUnsetRatio = true
			}
			if !ratioSuccess && !acceptUnsetRatio {
				return hosttypes.PriceData{}, modelPriceNotConfiguredError(matchName, info.UserId)
			}
		}
	}
	if ratio, ok := userPricingFloat(effective.Pricing, "ModelRatio"); ok {
		modelRatio = ratio
		usePrice = false
	}

	var quota int
	freeModel := false

	if usePrice {
		var err error
		quota, err = common.QuotaFromFloatStrict(modelPrice * common.QuotaPerUnit * groupRatioInfo.GroupRatio)
		if err != nil {
			return hosttypes.PriceData{}, err
		}
		if !operation_setting.GetQuotaSetting().EnableFreeModelPreConsume {
			if groupRatioInfo.GroupRatio == 0 || modelPrice == 0 {
				quota = 0
				freeModel = true
			}
		}
	} else {
		// 按量计费：以模型倍率的一半作为预扣额度
		var err error
		quota, err = common.QuotaFromFloatStrict(modelRatio / 2 * common.QuotaPerUnit * groupRatioInfo.GroupRatio)
		if err != nil {
			return hosttypes.PriceData{}, err
		}
		modelPrice = -1
		if !operation_setting.GetQuotaSetting().EnableFreeModelPreConsume {
			if groupRatioInfo.GroupRatio == 0 || modelRatio == 0 {
				quota = 0
				freeModel = true
			}
		}
	}

	priceData := hosttypes.PriceData{
		FreeModel:      freeModel,
		ModelPrice:     modelPrice,
		ModelRatio:     modelRatio,
		UsePrice:       usePrice,
		Quota:          quota,
		GroupRatioInfo: groupRatioInfo,
	}
	return priceData, nil
}

func HasModelBillingConfig(modelName string) bool {
	if _, ok := ratio_setting.GetModelPrice(modelName, false); ok {
		return true
	}
	if _, ok, _ := ratio_setting.GetModelRatio(modelName); ok {
		return true
	}
	if billing_setting.GetBillingMode(modelName) != billing_setting.BillingModeTieredExpr {
		return false
	}
	expr, ok := billing_setting.GetBillingExpr(modelName)
	return ok && strings.TrimSpace(expr) != ""
}

// HasPriceOrRatioEntry reports whether name has a configured price, ratio, or
// tiered billing-mode entry after a single wildcard normalization. Self-use
// fallback does not count as a configured ratio.
func HasPriceOrRatioEntry(name string) bool {
	formatted := ratio_setting.FormatMatchingModelName(name)
	if _, ok := ratio_setting.GetModelPrice(formatted, false); ok {
		return true
	}
	if ratio_setting.HasConfiguredModelRatio(formatted) {
		return true
	}
	return billing_setting.GetBillingMode(formatted) == billing_setting.BillingModeTieredExpr
}

func resolveBillingModelName(origin string) string {
	var candidates []string
	if !reasoning.ParseModelModifiers(origin).HasModifiers() {
		candidates = append(candidates, origin)
	}
	candidates = append(candidates, hostreasoning.CanonicalBillingModelNames(origin)...)
	base := hostreasoning.BaseModelName(origin)
	candidates = append(candidates, base)

	seen := make(map[string]struct{}, len(candidates))
	matched := ""
	for _, name := range candidates {
		if name == "" {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		if HasPriceOrRatioEntry(name) {
			matched = name
			break
		}
	}
	if matched == "" {
		matched = base
	}
	return matched
}

func modelPriceHelperTiered(c *gin.Context, info *relaycommon.RelayInfo, billingModelName, exprStr string, promptTokens int, meta *types.TokenCountMeta, groupRatioInfo hosttypes.GroupRatioInfo) (hosttypes.PriceData, error) {
	if info.RelayFormat == types.RelayFormatOpenAIRealtime && billingexpr.UsesFixedPricing(exprStr) {
		return hosttypes.PriceData{}, fmt.Errorf("fixed pricing is not supported for Realtime requests")
	}

	estimatedCompletionTokens := 0
	if meta != nil {
		estimatedCompletionTokens = meta.MaxTokens
	}
	if estimatedCompletionTokens == 0 && groupRatioInfo.GroupRatio != 0 {
		estimatedCompletionTokens = defaultTieredPreConsumeMaxTokens
	}

	requestInput, err := ResolveIncomingBillingExprRequestInput(c, info)
	if err != nil {
		return hosttypes.PriceData{}, err
	}

	rawCost, trace, err := billingexpr.RunExprWithRequest(exprStr, billingexpr.TokenParams{
		P:   float64(promptTokens),
		C:   float64(estimatedCompletionTokens),
		Len: float64(promptTokens),
	}, requestInput)
	if err != nil {
		return hosttypes.PriceData{}, fmt.Errorf("model %s tiered expr run failed: %w", billingModelName, err)
	}

	// Expression coefficients are $/1M tokens prices; convert to quota the same way per-call billing does.
	quotaBeforeGroup := rawCost / 1_000_000 * common.QuotaPerUnit
	preConsumedQuota, err := billingexpr.QuotaRoundStrict(quotaBeforeGroup * groupRatioInfo.GroupRatio)
	if err != nil {
		return hosttypes.PriceData{}, err
	}

	freeModel := false
	if !operation_setting.GetQuotaSetting().EnableFreeModelPreConsume {
		if groupRatioInfo.GroupRatio == 0 {
			preConsumedQuota = 0
			freeModel = true
		}
	}

	exprHash := billingexpr.ExprHashString(exprStr)
	snapshot := &billingexpr.BillingSnapshot{
		BillingMode:               billing_setting.BillingModeTieredExpr,
		ModelName:                 billingModelName,
		ExprString:                exprStr,
		ExprHash:                  exprHash,
		GroupRatio:                groupRatioInfo.GroupRatio,
		EstimatedPromptTokens:     promptTokens,
		EstimatedCompletionTokens: estimatedCompletionTokens,
		EstimatedQuotaBeforeGroup: quotaBeforeGroup,
		EstimatedQuotaAfterGroup:  preConsumedQuota,
		EstimatedTier:             trace.MatchedTier,
		EstimatedBillingUnit:      trace.BillingUnit,
		EstimatedFixedPrice:       trace.FixedPrice,
		QuotaPerUnit:              common.QuotaPerUnit,
		ExprVersion:               billingexpr.ExprVersion(exprStr),
	}
	info.TieredBillingSnapshot = snapshot
	info.BillingRequestInput = &requestInput

	priceData := hosttypes.PriceData{
		FreeModel:         freeModel,
		GroupRatioInfo:    groupRatioInfo,
		QuotaToPreConsume: preConsumedQuota,
	}

	logger.LogDebug(c, "model_price_helper_tiered result: model=%s preConsume=%d quotaBeforeGroup=%.2f groupRatio=%.2f tier=%s", billingModelName, preConsumedQuota, quotaBeforeGroup, groupRatioInfo.GroupRatio, trace.MatchedTier)

	info.PriceData = priceData
	return priceData, nil
}

func userPricingHas(pricing model.PricingValues, key string) bool {
	if pricing == nil {
		return false
	}
	_, ok := pricing[key]
	return ok
}

func userPricingFloat(pricing model.PricingValues, key string) (float64, bool) {
	if pricing == nil {
		return 0, false
	}
	raw, ok := pricing[key]
	if !ok || raw == nil {
		return 0, false
	}
	switch v := raw.(type) {
	case float64:
		return v, true
	case float32:
		return float64(v), true
	case int:
		return float64(v), true
	case int64:
		return float64(v), true
	default:
		return 0, false
	}
}

func PrepareAgentCostPricing(c *gin.Context, info *relaycommon.RelayInfo, modelName string, promptTokens int, meta *types.TokenCountMeta) error {
	if info == nil || info.AgentId <= 0 {
		return nil
	}
	pricing, ok := model.GetAgentModelCostPricing(info.AgentId, modelName)
	if !ok && info.OriginModelName != modelName {
		pricing, ok = model.GetAgentModelCostPricing(info.AgentId, info.OriginModelName)
		if ok {
			modelName = info.OriginModelName
		}
	}
	if !ok {
		return nil
	}

	mode, _ := pricing["billing_setting.billing_mode"].(string)
	if mode == billing_setting.BillingModeTieredExpr {
		if info.RelayFormat == types.RelayFormatTask || info.RelayFormat == types.RelayFormatMjProxy {
			return nil
		}
		expr, ok := pricing["billing_setting.billing_expr"].(string)
		if !ok || strings.TrimSpace(expr) == "" {
			return fmt.Errorf("agent cost for model %s has no billing expression", modelName)
		}
		if info.RelayFormat == types.RelayFormatOpenAIRealtime && billingexpr.UsesFixedPricing(expr) {
			return fmt.Errorf("fixed pricing is not supported for Realtime requests")
		}
		requestInput, err := ResolveIncomingBillingExprRequestInput(c, info)
		if err != nil {
			return err
		}
		estimatedCompletionTokens := 0
		if meta != nil {
			estimatedCompletionTokens = meta.MaxTokens
		}
		if estimatedCompletionTokens == 0 {
			estimatedCompletionTokens = defaultTieredPreConsumeMaxTokens
		}
		rawCost, trace, err := billingexpr.RunExprWithRequest(expr, billingexpr.TokenParams{
			P:   float64(promptTokens),
			C:   float64(estimatedCompletionTokens),
			Len: float64(promptTokens),
		}, requestInput)
		if err != nil {
			return fmt.Errorf("agent cost for model %s failed: %w", modelName, err)
		}
		estimatedQuota, err := billingexpr.QuotaRoundStrict(rawCost / 1_000_000 * common.QuotaPerUnit)
		if err != nil {
			return err
		}
		info.AgentCostTieredBillingSnapshot = &billingexpr.BillingSnapshot{
			BillingMode:               billing_setting.BillingModeTieredExpr,
			ModelName:                 modelName,
			ExprString:                expr,
			ExprHash:                  billingexpr.ExprHashString(expr),
			GroupRatio:                1,
			EstimatedPromptTokens:     promptTokens,
			EstimatedCompletionTokens: estimatedCompletionTokens,
			EstimatedQuotaBeforeGroup: float64(estimatedQuota),
			EstimatedQuotaAfterGroup:  estimatedQuota,
			EstimatedTier:             trace.MatchedTier,
			EstimatedBillingUnit:      trace.BillingUnit,
			EstimatedFixedPrice:       trace.FixedPrice,
			QuotaPerUnit:              common.QuotaPerUnit,
			ExprVersion:               billingexpr.ExprVersion(expr),
		}
		info.AgentCostBillingRequestInput = &requestInput
		return nil
	}

	modelPrice, usePrice := ratio_setting.GetModelPrice(modelName, false)
	if value, exists := userPricingFloat(pricing, "ModelPrice"); exists {
		modelPrice = value
		usePrice = true
	}
	modelRatio, _, _ := ratio_setting.GetModelRatio(modelName)
	if value, exists := userPricingFloat(pricing, "ModelRatio"); exists {
		modelRatio = value
		usePrice = false
	}
	completionRatio := ratio_setting.GetCompletionRatio(modelName)
	if value, exists := userPricingFloat(pricing, "CompletionRatio"); exists {
		completionRatio = value
	}
	cacheRatio, _ := ratio_setting.GetCacheRatio(modelName)
	if value, exists := userPricingFloat(pricing, "CacheRatio"); exists {
		cacheRatio = value
	}
	cacheCreationRatio, _ := ratio_setting.GetCreateCacheRatio(modelName)
	if value, exists := userPricingFloat(pricing, "CreateCacheRatio"); exists {
		cacheCreationRatio = value
	}
	imageRatio, _ := ratio_setting.GetImageRatio(modelName)
	if value, exists := userPricingFloat(pricing, "ImageRatio"); exists {
		imageRatio = value
	}
	audioRatio := ratio_setting.GetAudioRatio(modelName)
	if value, exists := userPricingFloat(pricing, "AudioRatio"); exists {
		audioRatio = value
	}
	audioCompletionRatio := ratio_setting.GetAudioCompletionRatio(modelName)
	if value, exists := userPricingFloat(pricing, "AudioCompletionRatio"); exists {
		audioCompletionRatio = value
	}
	info.AgentCostPriceData = &hosttypes.PriceData{
		ModelPrice:           modelPrice,
		ModelRatio:           modelRatio,
		CompletionRatio:      completionRatio,
		CacheRatio:           cacheRatio,
		CacheCreationRatio:   cacheCreationRatio,
		CacheCreation5mRatio: cacheCreationRatio,
		CacheCreation1hRatio: cacheCreationRatio * claudeCacheCreation1hMultiplier,
		ImageRatio:           imageRatio,
		AudioRatio:           audioRatio,
		AudioCompletionRatio: audioCompletionRatio,
		UsePrice:             usePrice,
		GroupRatioInfo: hosttypes.GroupRatioInfo{
			GroupRatio:        1,
			GroupSpecialRatio: -1,
		},
	}
	return nil
}

func PrepareAgentTaskCostPricing(info *relaycommon.RelayInfo, facts map[string]any) error {
	if info == nil || info.AgentId <= 0 {
		return nil
	}
	modelName := info.GetBillingModelName()
	pricing, ok := model.GetAgentModelCostPricing(info.AgentId, modelName)
	if !ok && info.OriginModelName != modelName {
		pricing, ok = model.GetAgentModelCostPricing(info.AgentId, info.OriginModelName)
		if ok {
			modelName = info.OriginModelName
		}
	}
	if !ok {
		return nil
	}
	mode, _ := pricing["billing_setting.billing_mode"].(string)
	if mode != billing_setting.BillingModeTieredExpr {
		return nil
	}
	expression, ok := pricing["billing_setting.billing_expr"].(string)
	if !ok || strings.TrimSpace(expression) == "" {
		return fmt.Errorf("agent cost for model %s has no billing expression", modelName)
	}
	if billingexpr.UsesFixedPricing(expression) {
		return fmt.Errorf("fixed pricing is not supported for task usage expressions")
	}
	cost, trace, err := billingexpr.RunExprWithRequest(
		expression,
		billingexpr.TokenParams{},
		billingexpr.RequestInput{Usage: facts},
	)
	if err != nil {
		return fmt.Errorf("agent cost for model %s failed: %w", modelName, err)
	}
	quota, clamp := common.QuotaRoundChecked(cost * common.QuotaPerUnit)
	if clamp != nil {
		info.QuotaClamp = clamp
	}
	info.AgentCostTieredBillingSnapshot = &billingexpr.BillingSnapshot{
		BillingMode:               billing_setting.BillingModeTieredExpr,
		ModelName:                 modelName,
		ExprString:                expression,
		ExprHash:                  billingexpr.ExprHashString(expression),
		GroupRatio:                1,
		EstimatedQuotaBeforeGroup: cost * common.QuotaPerUnit,
		EstimatedQuotaAfterGroup:  quota,
		EstimatedTier:             trace.MatchedTier,
		QuotaPerUnit:              common.QuotaPerUnit,
		ExprVersion:               billingexpr.ExprVersion(expression),
		TaskUsageBilling:          true,
		UsageFacts:                maps.Clone(facts),
	}
	info.PlatformQuota = quota
	return nil
}

func AgentTaskCostUsesTiered(info *relaycommon.RelayInfo) bool {
	if info == nil || info.AgentId <= 0 {
		return false
	}
	pricing, ok := model.GetAgentModelCostPricing(info.AgentId, info.GetBillingModelName())
	if !ok && info.OriginModelName != info.GetBillingModelName() {
		pricing, ok = model.GetAgentModelCostPricing(info.AgentId, info.OriginModelName)
	}
	if !ok {
		return false
	}
	mode, _ := pricing["billing_setting.billing_mode"].(string)
	return mode == billing_setting.BillingModeTieredExpr
}

func SetAgentTaskPlatformQuota(info *relaycommon.RelayInfo) {
	if info == nil || info.AgentId <= 0 || info.PlatformQuota > 0 {
		return
	}
	if snapshot := info.AgentCostTieredBillingSnapshot; snapshot != nil {
		info.PlatformQuota = snapshot.EstimatedQuotaAfterGroup
		return
	}
	cost := info.AgentCostPriceData
	if cost == nil {
		return
	}
	baseQuota := cost.ModelRatio / 2 * common.QuotaPerUnit
	if cost.UsePrice {
		baseQuota = cost.ModelPrice * common.QuotaPerUnit
	}
	for key, ratio := range info.PriceData.OtherRatios() {
		cost.AddOtherRatio(key, ratio)
	}
	quota, clamp := common.QuotaFromFloatChecked(cost.ApplyOtherRatiosToFloat(baseQuota))
	if clamp != nil {
		info.QuotaClamp = clamp
	}
	info.PlatformQuota = quota
}
