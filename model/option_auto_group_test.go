package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateContactOptions(t *testing.T) {
	require.NoError(t, validateOptionValue("ContactPhone", "  "))
	require.NoError(t, validateOptionValue("ContactPhone", "400-800-1234"))
	require.NoError(t, validateOptionValue("ContactPhone", "+86 138 0000 0000"))
	assert.Error(t, validateOptionValue("ContactPhone", "abc"))
	assert.Error(t, validateOptionValue("ContactPhone", "+"))
	assert.Error(t, validateOptionValue("ContactPhone", strings.Repeat("1", 41)))

	require.NoError(t, validateOptionValue("ContactWeChatQRCode", ""))
	require.NoError(t, validateOptionValue("ContactWeChatQRCode", "https://cdn.example.com/wechat.png"))
	require.NoError(t, validateOptionValue("ContactWeChatQRCode", "data:image/png;base64,aaaa"))
	assert.Error(t, validateOptionValue("ContactWeChatQRCode", "javascript:alert(1)"))
	assert.Error(t, validateOptionValue("ContactWeChatQRCode", "data:image/svg+xml;base64,aaaa"))
	assert.Error(t, validateOptionValue("ContactWeChatQRCode", "data:text/html;base64,aaaa"))
	assert.Error(t, validateOptionValue("ContactWeChatQRCode", strings.Repeat("a", 1_500_001)))
	assert.Equal(t, "400-800-1234", normalizeOptionValue("ContactPhone", " 400-800-1234 "))
}

func TestValidateOptionValueRejectsInvalidMaxTokenAutoGroups(t *testing.T) {
	for _, value := range []string{"", "0", "-1", "1.5", "invalid"} {
		t.Run(value, func(t *testing.T) {
			assert.Error(t, validateOptionValue("MaxTokenAutoGroups", value))
		})
	}
	require.NoError(t, validateOptionValue("MaxTokenAutoGroups", "999999"))
}
