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
import { describe, expect, test } from 'vitest'

import { calculatePresetPricing, resolvePresetQuoteInputs } from '../format'

describe('agent preset amounts', () => {
  test('shows the configured RMB amount and the agent unit price', () => {
    const quote = resolvePresetQuoteInputs({
      agentId: 3,
      unitPrice: 1,
      platformPrice: 7.3,
      exchangeRate: 7,
    })
    const priced = calculatePresetPricing(100, quote.priceRatio, 1, quote.exchangeRate)

    expect(priced.displayValue).toBe(100)
    expect(priced.actualPrice).toBe(100)
  })

  test('keeps platform presets in USD converted by the display rate', () => {
    const quote = resolvePresetQuoteInputs({
      agentId: 0,
      unitPrice: 1,
      platformPrice: 7.3,
      exchangeRate: 7,
    })
    const priced = calculatePresetPricing(100, quote.priceRatio, 1, quote.exchangeRate)

    expect(priced.displayValue).toBe(700)
    expect(priced.actualPrice).toBe(730)
  })
})
