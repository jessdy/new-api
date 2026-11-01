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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Channel } from '../../../types'
import { ChannelTestDialog } from '../channel-test-dialog'

const handleTestChannelMock = vi.fn()

vi.mock('../../../lib', async () => {
  const actual = await vi.importActual<typeof import('../../../lib')>(
    '../../../lib'
  )
  return {
    ...actual,
    handleTestChannel: (
      ...args: Parameters<typeof actual.handleTestChannel>
    ) => handleTestChannelMock(...args),
  }
})

vi.mock('../../channels-provider', () => ({
  useChannels: () => ({
    currentRow: {
      id: 42,
      type: 1,
      key: 'sk-test',
      status: 1,
      name: 'demo-channel',
      created_time: 0,
      test_time: 0,
      response_time: 0,
      balance: 0,
      balance_updated_time: 0,
      models: 'gpt-4o-mini',
      group: 'default',
      used_quota: 0,
      other: '',
      other_info: '',
      remark: '',
      max_input_tokens: 0,
      settings: '{}',
      channel_info: {
        is_multi_key: false,
        multi_key_size: 0,
        multi_key_polling_index: 0,
        multi_key_mode: 'random',
      },
    } satisfies Channel,
  }),
}))

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}))

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <ChannelTestDialog open onOpenChange={() => undefined} />
    </QueryClientProvider>
  )
}

describe('ChannelTestDialog full test', () => {
  beforeEach(() => {
    handleTestChannelMock.mockReset()
    handleTestChannelMock.mockImplementation(
      async (
        _id: number,
        _options: unknown,
        onTestComplete?: (
          success: boolean,
          responseTime?: number,
          error?: string,
          errorCode?: string
        ) => void
      ) => {
        onTestComplete?.(true, 150)
      }
    )
  })

  it('opens full test config and shows success rate with average latency', async () => {
    const user = userEvent.setup()
    renderDialog()

    expect(screen.getByText('gpt-4o-mini')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Full test' }))
    expect(screen.getByText('Full test for gpt-4o-mini')).toBeTruthy()
    expect(
      screen.getByText(
        'This will send real upstream requests and may incur usage charges.'
      )
    ).toBeTruthy()

    const roundsInput = screen.getByLabelText('Requests')
    const concurrencyInput = screen.getByLabelText('Concurrency')
    await user.clear(roundsInput)
    await user.type(roundsInput, '3')
    await user.clear(concurrencyInput)
    await user.type(concurrencyInput, '2')

    await user.click(screen.getByRole('button', { name: 'Start full test' }))

    await waitFor(() => {
      expect(handleTestChannelMock).toHaveBeenCalledTimes(3)
    })

    await waitFor(() => {
      expect(screen.getByText(/Success rate:\s*100%/)).toBeTruthy()
      expect(screen.getByText(/Avg latency:\s*150ms/)).toBeTruthy()
      expect(screen.getByTestId('full-test-availability-strip')).toBeTruthy()
      expect(
        screen
          .getByTestId('full-test-availability-strip')
          .querySelectorAll('[data-tone="good"]').length
      ).toBeGreaterThan(0)
    })
  })
})
