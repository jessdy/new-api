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
import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import type { AgentSummary } from '@/features/agent/api'

import { AgentsAdminTable } from '../agents-admin-table'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children?: React.ReactNode }) => <a>{props.children}</a>,
}))

afterEach(() => {
  vi.restoreAllMocks()
})

const agent: AgentSummary = {
  id: 7,
  user_id: 3,
  username: 'alice',
  name: 'Alice Agency',
  invite_code: 'alice01',
  status: 'enabled',
  credit_limit: 0,
  settlement_debt: 0,
  monthly_sales: 500000,
  total_sales: 1500000,
  unpaid_bill_id: 11,
}

it('renders agent user, channel code, sales, and actions', () => {
  render(
    <AgentsAdminTable
      agents={[agent]}
      loading={false}
      error={false}
      onRetry={() => undefined}
      onChanged={() => undefined}
    />
  )

  expect(screen.getByText('alice')).toBeInTheDocument()
  expect(screen.getByText('alice01')).toBeInTheDocument()
  expect(screen.getByText('Enabled')).toBeInTheDocument()
  expect(screen.getByText('Manage console')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Mark bill paid' })).toBeEnabled()
})

it('disables mark-paid when there is no unpaid bill', () => {
  render(
    <AgentsAdminTable
      agents={[{ ...agent, unpaid_bill_id: 0 }]}
      loading={false}
      error={false}
      onRetry={() => undefined}
      onChanged={() => undefined}
    />
  )

  expect(screen.getByRole('button', { name: 'Mark bill paid' })).toBeDisabled()
})
