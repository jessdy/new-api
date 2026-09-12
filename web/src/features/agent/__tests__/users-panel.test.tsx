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
along with this program. If you did not, see <https://www.gnu.org/licenses/>.
*/
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import * as agentApi from '@/features/agent/api'
import { AgentUsersPanel } from '@/features/agent/components/agent-users-panel'

afterEach(() => {
  vi.restoreAllMocks()
})

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <AgentUsersPanel />
    </QueryClientProvider>
  )
}

it('shows invited users returned by the agent users API', async () => {
  vi.spyOn(agentApi, 'listAgentUsers').mockResolvedValue({
    items: [
      {
        id: 12,
        username: 'invited-alice',
        display_name: 'Alice',
        status: 1,
        group: 'default',
        quota: 100,
        used_quota: 0,
      },
    ],
    total: 1,
    page: 1,
    page_size: 50,
  })

  renderPanel()

  expect(
    await screen.findByText(/#12 invited-alice/)
  ).toBeInTheDocument()
})

it('shows an empty state when the agent has no invited users', async () => {
  vi.spyOn(agentApi, 'listAgentUsers').mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    page_size: 50,
  })

  renderPanel()

  expect(await screen.findByText('No users yet')).toBeInTheDocument()
  expect(
    screen.getByText(
      "Users registered with your invite code or a salesperson's invite code appear here."
    )
  ).toBeInTheDocument()
})

it('shows a retryable error when the agent users API fails', async () => {
  vi.spyOn(agentApi, 'listAgentUsers').mockRejectedValue(
    new Error('Failed to load agent users')
  )

  renderPanel()

  await waitFor(() => {
    expect(screen.getByText('Failed to load agent users')).toBeInTheDocument()
  })
  expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
})

it('lets an agent mark an invited user as sales', async () => {
  vi.spyOn(agentApi, 'listAgentUsers').mockResolvedValue({
    items: [
      {
        id: 12,
        username: 'invited-alice',
        display_name: 'Alice',
        status: 1,
        group: 'default',
        quota: 100,
        used_quota: 0,
        aff_code: 'al12',
        inviter_username: 'reseller',
        agent_member_role: 'user',
      },
    ],
    total: 1,
    page: 1,
    page_size: 50,
  })
  const update = vi.spyOn(agentApi, 'updateAgentUser').mockResolvedValue()

  renderPanel()

  expect(await screen.findByText('End user')).toBeInTheDocument()
  expect(screen.getByText(/Invited by/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Mark as sales' }))
  expect(update).toHaveBeenCalledWith(12, { agent_member_role: 'sales' }, undefined)
})
