package billingexpr

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTaskUsageExpressionUsesFactsAndTaskQuotaConversion(t *testing.T) {
	expression := `tier("1080p", u("seconds") * (u("resolution") == "1080p" ? 0.4 : 0.2))`
	cost, trace, err := RunExprWithRequest(expression, TokenParams{}, RequestInput{Usage: map[string]any{"seconds": 10.0, "resolution": "1080p"}})
	require.NoError(t, err)
	assert.Equal(t, 4.0, cost)
	assert.Equal(t, "1080p", trace.MatchedTier)
	result, err := ComputeTieredQuotaWithRequest(&BillingSnapshot{ExprString: expression, ExprHash: ExprHashString(expression), GroupRatio: 2, QuotaPerUnit: 500000, ExprVersion: 1, TaskUsageBilling: true}, TokenParams{}, RequestInput{Usage: map[string]any{"seconds": 10.0, "resolution": "1080p"}})
	require.NoError(t, err)
	assert.Equal(t, 4_000_000, result.ActualQuotaAfterGroup)
}

func TestTaskUsageNilCoalesceDefaultsWhenUsageMissing(t *testing.T) {
	// HTTP image agent cost and task estimates often multiply u("image_count")
	// with an empty Usage map. The runtime defaults image_count→1 and
	// input_image_count→0 so both the bare and ?? forms succeed; other u()
	// keys still return nil.
	bare := `tier("base", u("image_count") * 0.02 + u("input_image_count") * 0)`
	cost, trace, err := RunExprWithRequest(bare, TokenParams{}, RequestInput{Usage: map[string]any{}})
	require.NoError(t, err)
	assert.Equal(t, 0.02, cost)
	require.NotNil(t, trace.ImageCount)
	assert.Equal(t, 1, *trace.ImageCount)

	safe := `tier("base", (u("image_count") ?? 1) * 0.02 + (u("input_image_count") ?? 0) * 0)`
	cost, _, err = RunExprWithRequest(safe, TokenParams{}, RequestInput{Usage: map[string]any{}})
	require.NoError(t, err)
	assert.Equal(t, 0.02, cost)

	n := 3
	cost, trace, err = RunExprWithRequest(bare, TokenParams{}, RequestInput{ImageCount: &n})
	require.NoError(t, err)
	assert.Equal(t, 0.06, cost)
	require.NotNil(t, trace.ImageCount)
	assert.Equal(t, 3, *trace.ImageCount)

	_, _, err = RunExprWithRequest(`tier("base", u("seconds") * 0.4)`, TokenParams{}, RequestInput{})
	require.ErrorContains(t, err, "invalid operation: <nil> * float64")
}
