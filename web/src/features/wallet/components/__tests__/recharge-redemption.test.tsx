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
import { afterEach, describe, expect, it } from 'vitest'

import type { TopupInfo } from '../../types'
import { RechargeFormCard } from '../recharge-form-card'

const complianceNotice =
  'Redemption codes are disabled until the administrator confirms compliance terms.'

function topupInfo(enableRedemption: boolean): TopupInfo {
  return {
    enable_online_topup: true,
    enable_stripe_topup: false,
    pay_methods: [{ name: 'Alipay', type: 'alipay_native' }],
    min_topup: 1,
    stripe_min_topup: 1,
    amount_options: [100],
    discount: {},
    enable_redemption: enableRedemption,
  }
}

function renderCard(enableRedemption: boolean) {
  render(
    <RechargeFormCard
      topupInfo={topupInfo(enableRedemption)}
      presetAmounts={[{ value: 100 }]}
      selectedPreset={null}
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
    />
  )
}

afterEach(() => {
  cleanup()
})

describe('wallet redemption section', () => {
  it('hides the compliance notice when redemption is unavailable', () => {
    renderCard(false)

    expect(screen.queryByText(complianceNotice)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Have a Code?')).not.toBeInTheDocument()
  })

  it('shows the redemption input when redemption is enabled', () => {
    renderCard(true)

    expect(screen.getByLabelText('Have a Code?')).toBeInTheDocument()
    expect(screen.queryByText(complianceNotice)).not.toBeInTheDocument()
  })
})
