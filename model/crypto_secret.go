package model

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

const cryptoSecretOptionKey = "CryptoSecret"

// LoadOrPersistCryptoSecret keeps AES-GCM payment payloads readable across
// restarts when CRYPTO_SECRET and SESSION_SECRET are not set.
func LoadOrPersistCryptoSecret() error {
	if os.Getenv("CRYPTO_SECRET") != "" || os.Getenv("SESSION_SECRET") != "" {
		return nil
	}
	if DB == nil {
		return nil
	}
	var opt Option
	err := DB.Where("key = ?", cryptoSecretOptionKey).Take(&opt).Error
	if err == nil && strings.TrimSpace(opt.Value) != "" {
		common.CryptoSecret = opt.Value
		common.SysLog("loaded CryptoSecret from database")
		return nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return fmt.Errorf("load CryptoSecret: %w", err)
	}
	if !common.IsMasterNode {
		common.SysError("CRYPTO_SECRET is not configured; encrypted agent payment config will not survive restart")
		return nil
	}
	if strings.TrimSpace(common.CryptoSecret) == "" {
		return nil
	}
	if err == nil {
		if err := DB.Model(&opt).Update("value", common.CryptoSecret).Error; err != nil {
			return fmt.Errorf("persist CryptoSecret: %w", err)
		}
	} else if err := DB.Create(&Option{Key: cryptoSecretOptionKey, Value: common.CryptoSecret}).Error; err != nil {
		return fmt.Errorf("persist CryptoSecret: %w", err)
	}
	common.SysLog("persisted CryptoSecret to database so encrypted agent payment config survives restart; set CRYPTO_SECRET or SESSION_SECRET in the environment for production")
	return nil
}
