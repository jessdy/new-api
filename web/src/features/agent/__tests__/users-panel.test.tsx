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
import { render, screen, waitFor, within } from '@testing-library/react'
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

  expect(await screen.findByText(/#12 invited-alice/)).toBeInTheDocument()
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

it('shows a user remark and saves an edited note', async () => {
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
        agent_remark: '重点客户',
      },
    ],
    total: 1,
    page: 1,
    page_size: 50,
  })
  const update = vi.spyOn(agentApi, 'updateAgentUser').mockResolvedValue()
  const user = userEvent.setup()

  renderPanel()

  expect(await screen.findByText('重点客户')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Remark' }))
  const note = screen.getByLabelText('Add a note about this user')
  await user.clear(note)
  await user.type(note, '已跟进')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => {
    expect(update).toHaveBeenCalledWith(
      12,
      { agent_remark: '已跟进' },
      undefined
    )
  })
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
  expect(screen.getByText('reseller')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Adjust Quota' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Model Settings' })).toBeEnabled()
  await userEvent.click(screen.getByRole('button', { name: 'Mark as sales' }))
  expect(update).toHaveBeenCalledWith(
    12,
    { agent_member_role: 'sales' },
    undefined
  )
})

it('opens the quota dialog for an invited user', async () => {
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
        agent_member_role: 'user',
      },
    ],
    total: 1,
    page: 1,
    page_size: 50,
  })

  renderPanel()

  await userEvent.click(
    await screen.findByRole('button', { name: 'Adjust Quota' })
  )
  expect(
    await screen.findByText('Select an operation mode and enter the amount')
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
})

it('deletes a user after confirmation', async () => {
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
    page_size: 100,
  })
  const remove = vi.spyOn(agentApi, 'deleteAgentUser').mockResolvedValue()
  const user = userEvent.setup()

  renderPanel()

  await user.click(await screen.findByRole('button', { name: 'Delete' }))
  const dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

  await waitFor(() => {
    expect(remove).toHaveBeenCalledWith(12, undefined)
  })
})

it('loads deleted users when the status filter changes', async () => {
  const list = vi
    .spyOn(agentApi, 'listAgentUsers')
    .mockImplementation(async (_page, _pageSize, _agentId, status) => {
      if (status === -1) {
        return {
          items: [
            {
              id: 9,
              username: 'gone-user',
              display_name: 'Gone',
              status: 1,
              group: 'default',
              quota: 0,
              used_quota: 0,
              deleted: true,
            },
          ],
          total: 1,
          page: 1,
          page_size: 100,
        }
      }
      return {
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
        page_size: 100,
      }
    })
  const user = userEvent.setup()

  renderPanel()

  expect(await screen.findByText(/#12 invited-alice/)).toBeInTheDocument()
  await user.click(screen.getByRole('combobox', { name: 'Status' }))
  await user.click(await screen.findByRole('option', { name: 'Deleted' }))

  expect(await screen.findByText(/#9 gone-user/)).toBeInTheDocument()
  expect(screen.getAllByText('Deleted').length).toBeGreaterThan(1)
  expect(
    screen.queryByRole('button', { name: 'Delete' })
  ).not.toBeInTheDocument()
  expect(list).toHaveBeenCalledWith(1, 100, undefined, -1)
})
