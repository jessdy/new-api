package common

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
)

var (
	ErrCryptoSecretMissing  = errors.New("crypto secret is not configured")
	ErrCryptoPayloadInvalid = errors.New("invalid encrypted payload")
)

// EncryptPayload seals plaintext with AES-GCM using CryptoSecret.
func EncryptPayload(plaintext string) (string, error) {
	if CryptoSecret == "" {
		return "", ErrCryptoSecretMissing
	}
	block, err := aes.NewCipher([]byte(normalizeCryptoSecret(CryptoSecret)))
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	sealed := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.RawStdEncoding.EncodeToString(sealed), nil
}

// DecryptPayload opens an EncryptPayload ciphertext.
func DecryptPayload(ciphertext string) (string, error) {
	if CryptoSecret == "" {
		return "", ErrCryptoSecretMissing
	}
	if ciphertext == "" {
		return "", nil
	}
	raw, err := base64.RawStdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", ErrCryptoPayloadInvalid
	}
	block, err := aes.NewCipher([]byte(normalizeCryptoSecret(CryptoSecret)))
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(raw) < gcm.NonceSize() {
		return "", ErrCryptoPayloadInvalid
	}
	nonce, sealed := raw[:gcm.NonceSize()], raw[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, sealed, nil)
	if err != nil {
		return "", ErrCryptoPayloadInvalid
	}
	return string(plain), nil
}

func normalizeCryptoSecret(secret string) []byte {
	// AES-256 key: hash-expand via repeating/truncating to 32 bytes.
	buf := make([]byte, 32)
	if len(secret) == 0 {
		return buf
	}
	for i := range buf {
		buf[i] = secret[i%len(secret)]
	}
	return buf
}
