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
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import { formatTopupHistoryAmount } from '../billing'

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
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
})

describe('formatTopupHistoryAmount', () => {
  it('shows an agent recharge in yuan without applying the exchange rate again', () => {
    expect(formatTopupHistoryAmount({ amount: 1, agent_id: 12 })).toBe('¥1')
  })

  it('converts a platform recharge from USD into the display currency', () => {
    expect(formatTopupHistoryAmount({ amount: 1, agent_id: 0 })).toBe('¥7')
  })
})
