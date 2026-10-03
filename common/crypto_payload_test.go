package common

import (
	"encoding/base64"
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

	padded := stdEncodingPadded(sealed)
	plain, err = DecryptPayload(padded)
	require.NoError(t, err)
	assert.Equal(t, `{"epay_key":"abc"}`, plain)

	_, err = DecryptPayload("not-valid-ciphertext")
	assert.ErrorIs(t, err, ErrCryptoPayloadInvalid)
}

func stdEncodingPadded(raw string) string {
	decoded, err := base64.RawStdEncoding.DecodeString(raw)
	if err != nil {
		return raw
	}
	return base64.StdEncoding.EncodeToString(decoded)
}
