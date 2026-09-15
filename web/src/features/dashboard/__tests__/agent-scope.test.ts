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
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { getAgentModelBillingLogs } from '@/features/usage-logs/api'

import { getPlatformUsageSummary, getUserQuotaDates } from '../api'

const { get } = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: { get },
}))

describe('agent dashboard usage scope', () => {
  const params = {
    start_timestamp: 1,
    end_timestamp: 2,
  }

  beforeEach(() => {
    get.mockReset()
    get.mockResolvedValue({ data: { success: true, data: [] } })
  })

  test('uses the agent aggregate endpoint when only-self is off', async () => {
    await getUserQuotaDates(params, false, true)

    expect(get).toHaveBeenCalledWith('/api/data/agent', { params })
  })

  test('uses the self endpoint when only-self is on', async () => {
    await getUserQuotaDates(params, false, false)

    expect(get).toHaveBeenCalledWith('/api/data/self', { params })
  })

  test('uses the platform endpoint for administrators', async () => {
    await getUserQuotaDates(params, true)

    expect(get).toHaveBeenCalledWith('/api/data', { params })
  })

  test('loads platform-wide overview totals from the admin endpoint', async () => {
    await getPlatformUsageSummary()

    expect(get).toHaveBeenCalledWith('/api/data/summary')
  })

  test('loads downstream user billing records from the agent endpoint', async () => {
    await getAgentModelBillingLogs({
      p: 1,
      page_size: 20,
      model_name: 'glm-5.3',
      start_timestamp: 1,
      end_timestamp: 2,
    })

    expect(get).toHaveBeenCalledWith(
      '/api/log/agent/billing?p=1&page_size=20&model_name=glm-5.3&start_timestamp=1&end_timestamp=2'
    )
  })
})
