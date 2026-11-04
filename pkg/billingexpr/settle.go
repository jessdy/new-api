package billingexpr

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
)

// quotaConversion converts raw expression output to quota based on the
// expression version. This is the central dispatch point for future versions
// that may use a different conversion formula.
func quotaConversion(exprOutput float64, snap *BillingSnapshot) float64 {
	if snap != nil && snap.TaskUsageBilling {
		return exprOutput * snap.QuotaPerUnit
	}
	switch {
	case snap != nil:
		switch snap.ExprVersion {
		default: // v1: coefficients are $/1M tokens prices
			return exprOutput / 1_000_000 * snap.QuotaPerUnit
		}
	default:
		return exprOutput / 1_000_000
	}
}

// QuotaFromExprOutput converts a raw expression result to quota units using the
// snapshot's TaskUsageBilling flag and ExprVersion. Callers that re-run an
// expression outside ComputeTieredQuota (image pre-consume, agent/channel cost)
// MUST use this so u("…")*USD meters are not divided by 1e6.
func QuotaFromExprOutput(exprOutput float64, snap *BillingSnapshot) float64 {
	return quotaConversion(exprOutput, snap)
}

// UsesTaskUsageMeter reports whether the expression reads task usage facts via
// u("…"). Those coefficients are USD amounts and must use TaskUsageBilling
// conversion even when the request arrives on an ordinary HTTP image relay.
func UsesTaskUsageMeter(exprStr string) bool {
	return len(UsedUsageKeys(exprStr)) > 0
}

// ComputeTieredQuota runs the Expr from a frozen BillingSnapshot against
// actual token counts and returns the settlement result.
func ComputeTieredQuota(snap *BillingSnapshot, params TokenParams) (TieredResult, error) {
	return ComputeTieredQuotaWithRequest(snap, params, RequestInput{})
}

func ComputeTieredQuotaWithRequest(snap *BillingSnapshot, params TokenParams, request RequestInput) (TieredResult, error) {
	if snap.TaskUsageBilling && UsesFixedPricingByHash(snap.ExprString, snap.ExprHash) {
		return TieredResult{}, fmt.Errorf("fixed pricing is not supported for task usage expressions")
	}
	cost, trace, err := RunExprByHashWithRequest(snap.ExprString, snap.ExprHash, params, request)
	if err != nil {
		return TieredResult{}, err
	}

	quotaBeforeGroup := quotaConversion(cost, snap)
	afterGroup, clamp := common.QuotaRoundChecked(quotaBeforeGroup * snap.GroupRatio)
	crossed := trace.MatchedTier != snap.EstimatedTier

	result := TieredResult{
		ImageCount:             trace.ImageCount,
		BillingUnit:            trace.BillingUnit,
		FixedPrice:             trace.FixedPrice,
		ActualQuotaBeforeGroup: quotaBeforeGroup,
		ActualQuotaAfterGroup:  afterGroup,
		MatchedTier:            trace.MatchedTier,
		RequestRules:           trace.RequestRules,
		CrossedTier:            crossed,
		Clamp:                  clamp,
	}
	if trace.BillingUnit == BillingUnitToken && UsedVarsByHash(snap.ExprString, snap.ExprHash)["img_cr"] {
		result.BillingTokens = &params
	}
	return result, nil
}
