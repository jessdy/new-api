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
*/
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import * as agentApi from '@/features/agent/api'
import { AgentSettlementPanel } from '@/features/agent/components/agent-settlement-panel'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

afterEach(() => {
  vi.restoreAllMocks()
  useAuthStore.getState().auth.reset()
})

const usage = {
  users: [
    {
      user_id: 601,
      username: 'settle-user',
      count: 2,
      quota: 30,
      platform_quota: 13,
      channel_quota: 7,
      token_used: 14,
      prompt_tokens: 11,
      completion_tokens: 3,
      cache_tokens: 3,
      models: [
        {
          model_name: 'gpt-4.1',
          count: 1,
          prompt_tokens: 8,
          completion_tokens: 2,
          cache_tokens: 2,
          unit_price: 2,
          input_unit_price: 2,
          output_unit_price: 4,
          cache_unit_price: 1,
          quota: 20,
          platform_quota: 4,
          channel_quota: 2,
        },
      ],
    },
  ],
  models: [
    {
      model_name: 'gpt-4.1',
      count: 1,
      prompt_tokens: 8,
      completion_tokens: 2,
      cache_tokens: 2,
      unit_price: 2,
      input_unit_price: 2,
      output_unit_price: 4,
      cache_unit_price: 1,
      quota: 20,
      platform_quota: 4,
      channel_quota: 2,
    },
  ],
  count: 2,
  quota: 30,
  platform_quota: 13,
  channel_quota: 7,
  token_used: 14,
  prompt_tokens: 11,
  completion_tokens: 3,
  cache_tokens: 3,
}

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <AgentSettlementPanel agentId={9} />
    </QueryClientProvider>
  )
}

function mockSettlementApis() {
  vi.spyOn(agentApi, 'listAgentSettlement').mockResolvedValue({
    items: [],
    total: 0,
    settlement_debt: 0,
    credit_limit: 100,
  })
  vi.spyOn(agentApi, 'getAgentSettlementUsage').mockResolvedValue(usage)
}

it('lets an agent expand a user row to see per-model settlement details', async () => {
  useAuthStore.getState().auth.setUser({
    id: 9,
    username: 'agent',
    role: ROLE.AGENT,
  })
  mockSettlementApis()
  renderPanel()

  const userRow = await screen.findByText('#601 settle-user')
  expect(screen.queryByText('gpt-4.1')).toBeNull()
  expect(screen.queryByText('Export statement')).toBeNull()

  await userEvent.click(userRow)
  expect(await screen.findByText('gpt-4.1')).toBeTruthy()
  expect(screen.getByText('Input unit price')).toBeTruthy()
  expect(screen.getByText('Fee')).toBeTruthy()
})

it('lets an admin query and export a settlement statement', async () => {
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'admin',
    role: ROLE.ADMIN,
  })
  mockSettlementApis()
  renderPanel()

  expect(await screen.findByText('Settlement statement')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Query statement' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Export statement' })).toBeTruthy()
  await waitFor(() => {
    expect(screen.getAllByText('gpt-4.1').length).toBeGreaterThan(0)
  })
  expect(
    screen.getAllByText('Pending settlement amount').length
  ).toBeGreaterThan(0)
  expect(screen.getAllByText('Channel cost').length).toBeGreaterThan(0)
})
