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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ChannelCostPricesField } from '../channel-cost-prices-field'

vi.mock('@/features/system-settings/models/model-pricing-sheet', () => ({
  ModelPricingEditorPanel: () => <div>pricing editor</div>,
}))

vi.mock('@/lib/lobe-icon', () => ({
  getLobeIcon: () => null,
}))

describe('ChannelCostPricesField', () => {
  it('lists selected models and opens the cost editor for a model', async () => {
    const onChange = vi.fn()
    render(
      <ChannelCostPricesField
        models={['gpt-4']}
        value='{"gpt-4":{"ModelPrice":0.8}}'
        onChange={onChange}
      />
    )

    expect(screen.getByText('Cost prices')).toBeTruthy()
    expect(screen.getByText('gpt-4')).toBeTruthy()
    await userEvent.click(
      screen.getByRole('button', { name: 'Set cost price for gpt-4' })
    )
    expect(screen.getByText('Cost price')).toBeTruthy()
    expect(screen.getByText('pricing editor')).toBeTruthy()
  })

  it('asks the admin to select models before setting cost prices', () => {
    render(
      <ChannelCostPricesField models={[]} value='' onChange={() => undefined} />
    )

    expect(screen.getByText('No models selected')).toBeTruthy()
  })
})
