/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { cleanup, render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import zh from '@/i18n/locales/zh.json'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import type { TopupInfo } from '../../types'
import { RechargeFormCard } from '../recharge-form-card'

const i18n = createInstance()
await i18n.init({
  lng: 'zhCN',
  fallbackLng: 'zhCN',
  nsSeparator: false,
  keySeparator: false,
  initAsync: false,
  resources: { zhCN: zh },
})

const topupInfo: TopupInfo = {
  enable_online_topup: true,
  enable_stripe_topup: false,
  pay_methods: [{ name: 'Alipay', type: 'alipay_native' }],
  min_topup: 1,
  stripe_min_topup: 1,
  amount_options: [100, 200],
  discount: {},
  enable_redemption: false,
}

function renderPresets() {
  render(
    <I18nextProvider i18n={i18n}>
      <RechargeFormCard
        topupInfo={topupInfo}
        presetAmounts={[{ value: 100 }, { value: 200 }]}
        selectedPreset={100}
        onSelectPreset={() => {}}
        topupAmount={100}
        onTopupAmountChange={() => {}}
        paymentAmount={100}
        calculating={false}
        onPaymentMethodSelect={() => {}}
        paymentLoading={null}
        redemptionCode=''
        onRedemptionCodeChange={() => {}}
        onRedeem={() => {}}
        redeeming={false}
        priceRatio={1}
        usdExchangeRate={1}
      />
    </I18nextProvider>
  )
}

beforeEach(() => {
  useSystemConfigStore.setState({
    config: {
      ...useSystemConfigStore.getState().config,
      currency: {
        ...DEFAULT_CURRENCY_CONFIG,
        quotaDisplayType: 'CNY',
        usdExchangeRate: 7,
      },
    },
  })
})

afterEach(() => {
  cleanup()
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
})

describe('recharge preset amounts', () => {
  it('shows RMB amounts and a Chinese payment label', () => {
    renderPresets()

    expect(screen.getByRole('button', { name: /¥100/ })).toHaveTextContent(
      /支付\s*¥100/
    )
    expect(screen.getByRole('button', { name: /¥200/ })).toHaveTextContent(
      /支付\s*¥200/
    )
    expect(screen.getByRole('button', { name: '支付宝' })).toBeInTheDocument()
  })
})
