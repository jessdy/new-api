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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { getUserLogStats, getUserLogs } from '@/features/usage-logs/api'
import { formatLogQuota } from '@/lib/format'

import { ModelUsageTable } from '../model-usage-table'

vi.mock('@/features/usage-logs/api', () => ({
  getAgentLogStats: vi.fn(),
  getAgentModelBillingLogs: vi.fn(),
  getAllLogs: vi.fn(),
  getLogStats: vi.fn(),
  getUserLogStats: vi.fn(),
  getUserLogs: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('model usage table', () => {
  test('shows one aggregated row per model from the current filtered data', () => {
    const { rerender } = render(
      <ModelUsageTable
        data={[
          {
            created_at: 1,
            model_name: 'gpt-a',
            count: 2,
            prompt_tokens: 100,
            completion_tokens: 20,
            cache_tokens: 10,
            quota: 300,
          },
          {
            created_at: 2,
            model_name: 'gpt-a',
            count: 1,
            prompt_tokens: 40,
            completion_tokens: 10,
            cache_tokens: 5,
            quota: 100,
          },
          {
            created_at: 2,
            model_name: 'gpt-b',
            count: 5,
            prompt_tokens: 200,
            completion_tokens: 50,
            cache_tokens: 30,
            quota: 600,
          },
        ]}
      />
    )

    expect(
      screen.getByRole('columnheader', { name: 'Call Count' })
    ).toBeTruthy()
    const gptARow = screen.getByText('gpt-a').closest('tr')
    if (!gptARow) {
      throw new Error('Expected the gpt-a usage row')
    }
    expect(within(gptARow).getByText('3')).toBeTruthy()
    expect(within(gptARow).getByText('140')).toBeTruthy()
    expect(within(gptARow).getByText('30')).toBeTruthy()
    expect(within(gptARow).getByText('15')).toBeTruthy()

    rerender(
      <ModelUsageTable
        data={[
          {
            created_at: 2,
            model_name: 'gpt-b',
            count: 5,
            prompt_tokens: 200,
            completion_tokens: 50,
            cache_tokens: 30,
            quota: 600,
          },
        ]}
      />
    )

    expect(screen.queryByText('gpt-a')).toBeNull()
    expect(screen.getByText('gpt-b')).toBeTruthy()
  })

  test('opens the exact calculation details for a selected billing record', async () => {
    vi.mocked(getUserLogStats).mockResolvedValue({
      success: true,
      data: {
        quota: 12,
        rpm: 0,
        tpm: 0,
        prompt_tokens: 100,
        completion_tokens: 20,
        cache_tokens: 15,
      },
    })
    vi.mocked(getUserLogs).mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            id: 7,
            user_id: 11,
            created_at: 1000,
            type: 2,
            content: '',
            username: 'dashboard-user',
            token_name: '',
            model_name: 'gpt-a',
            quota: 12,
            prompt_tokens: 100,
            completion_tokens: 20,
            use_time: 1,
            is_stream: false,
            channel: 0,
            channel_name: '',
            token_id: 0,
            group: 'default',
            ip: '',
            other: JSON.stringify({
              model_ratio: 1,
              completion_ratio: 2,
              group_ratio: 1,
              cache_tokens: 15,
            }),
            request_id: 'req-7',
            upstream_request_id: '',
          },
        ],
        total: 1,
        page: 1,
        page_size: 20,
      },
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={queryClient}>
        <ModelUsageTable
          data={[
            {
              created_at: 1000,
              model_name: 'gpt-a',
              count: 1,
              prompt_tokens: 100,
              completion_tokens: 20,
              cache_tokens: 0,
              quota: 12,
            },
          ]}
          filters={{
            start_timestamp: new Date(3700 * 1000),
            end_timestamp: new Date(3800 * 1000),
          }}
        />
      </QueryClientProvider>
    )

    await user.click(
      screen.getByRole('button', { name: 'Billing Details: gpt-a' })
    )

    expect(await screen.findByText('Billing Details · gpt-a')).toBeTruthy()
    expect(await screen.findByText('Cache Tokens: 15')).toBeTruthy()
    expect(screen.getByText('Input Tokens: 100')).toBeTruthy()
    expect(screen.getByText('Output Tokens: 20')).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Cache Tokens' })).toBeTruthy()
    expect(screen.getAllByText('15').length).toBeGreaterThan(0)
    expect(getUserLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 2,
        model_name: 'gpt-a',
        start_timestamp: 3600,
        end_timestamp: 3800,
      })
    )

    await user.click(screen.getByRole('button', { name: formatLogQuota(12) }))
    expect(await screen.findByText('Log Details')).toBeTruthy()
    expect(screen.getByText('req-7')).toBeTruthy()
  })
})
