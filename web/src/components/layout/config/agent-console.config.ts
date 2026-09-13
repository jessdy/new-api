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
import type { TFunction } from 'i18next'
import {
  Box,
  CreditCard,
  Radio,
  Receipt,
  Tags,
  Users,
} from 'lucide-react'

import { AGENT_SECTIONS } from '@/features/agent/section-registry'

import type { NavGroup, SidebarView } from '../types'

const AGENT_SECTION_ICONS = {
  channels: Radio,
  models: Box,
  pricing: Tags,
  users: Users,
  payment: CreditCard,
  settlement: Receipt,
} as const

function getAgentConsoleNavGroups(t: TFunction): NavGroup[] {
  return [
    {
      id: 'agent-console',
      title: t('Agent Console'),
      items: AGENT_SECTIONS.map((section) => ({
        title: t(section.titleKey),
        url: `/agent/${section.id}`,
        icon: AGENT_SECTION_ICONS[section.id],
      })),
    },
  ]
}

/**
 * Nested sidebar view for `/agent/*`.
 *
 * Replaces the root navigation with Channels / Models / Pricing / Users /
 * Payment / Settlement so both reseller accounts and admins managing a
 * specific agent get the same secondary menu.
 */
export const AGENT_CONSOLE_VIEW: SidebarView = {
  id: 'agent-console',
  pathPattern: /^\/agent(\/|$)/,
  parent: {
    to: '/dashboard/overview',
    label: 'Back to Dashboard',
  },
  getNavGroups: getAgentConsoleNavGroups,
}
