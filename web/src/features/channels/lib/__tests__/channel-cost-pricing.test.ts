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
import { describe, expect, it } from 'vitest'

import {
  parseChannelCostPricing,
  pruneChannelCostPricing,
  stringifyChannelCostPricing,
} from '../channel-cost-pricing'

describe('channel cost pricing helpers', () => {
  it('round-trips a per-model cost map and drops models that are no longer selected', () => {
    const encoded = stringifyChannelCostPricing({
      'gpt-4': { ModelPrice: 0.5 },
      'old-model': { ModelRatio: 2 },
    })

    expect(parseChannelCostPricing(encoded)).toEqual({
      'gpt-4': { ModelPrice: 0.5 },
      'old-model': { ModelRatio: 2 },
    })
    expect(
      pruneChannelCostPricing(parseChannelCostPricing(encoded), ['gpt-4'])
    ).toEqual({
      'gpt-4': { ModelPrice: 0.5 },
    })
  })

  it('treats blank or invalid JSON as an empty cost map', () => {
    expect(parseChannelCostPricing('')).toEqual({})
    expect(parseChannelCostPricing('["nope"]')).toEqual({})
    expect(stringifyChannelCostPricing({})).toBe('')
  })
})
