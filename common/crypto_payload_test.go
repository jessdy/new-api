package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEncryptDecryptPayload(t *testing.T) {
	previous := CryptoSecret
	CryptoSecret = "unit-test-crypto-secret"
	t.Cleanup(func() { CryptoSecret = previous })

	sealed, err := EncryptPayload(`{"epay_key":"abc"}`)
	require.NoError(t, err)
	assert.NotEqual(t, `{"epay_key":"abc"}`, sealed)

	plain, err := DecryptPayload(sealed)
	require.NoError(t, err)
	assert.Equal(t, `{"epay_key":"abc"}`, plain)
}
