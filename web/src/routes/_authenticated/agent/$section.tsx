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
import { createFileRoute, redirect } from '@tanstack/react-router'
import z from 'zod'

import { AgentConsole } from '@/features/agent'
import {
  AGENT_DEFAULT_SECTION,
  isAgentSectionId,
} from '@/features/agent/section-registry'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

const agentSearchSchema = z.object({
  // URL query values arrive as strings; coerce so ?agent_id=1 is kept.
  agent_id: z.preprocess((value) => {
    if (value == null || value === '') return undefined
    const n = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(n) && n > 0 ? n : undefined
  }, z.number().int().positive().optional()),
})

export const Route = createFileRoute('/_authenticated/agent/$section')({
  beforeLoad: ({ params, search }) => {
    const { auth } = useAuthStore.getState()
    // Agents (role=5) use their own console; admins/root may manage via ?agent_id=
    if (!auth.user) {
      throw redirect({ to: '/403' })
    }
    const role = auth.user.role
    const isAgent = role === ROLE.AGENT
    const isAdmin = role >= ROLE.ADMIN
    if (!isAgent && !isAdmin) {
      throw redirect({ to: '/403' })
    }
    if (!isAgentSectionId(params.section)) {
      throw redirect({
        to: '/agent/$section',
        params: { section: AGENT_DEFAULT_SECTION },
        search,
      })
    }
  },
  validateSearch: agentSearchSchema,
  component: AgentConsole,
})
