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
export const AGENT_SECTIONS = [
  { id: 'channels', titleKey: 'Channels' },
  { id: 'models', titleKey: 'Models' },
  { id: 'pricing', titleKey: 'Pricing' },
  { id: 'users', titleKey: 'Users' },
  { id: 'payment', titleKey: 'Payment' },
  { id: 'settlement', titleKey: 'Settlement' },
] as const

export type AgentSectionId = (typeof AGENT_SECTIONS)[number]['id']

export const AGENT_SECTION_IDS = AGENT_SECTIONS.map(
  (section) => section.id
) as AgentSectionId[]

export const AGENT_DEFAULT_SECTION: AgentSectionId = 'channels'

export function isAgentSectionId(value: string): value is AgentSectionId {
  return AGENT_SECTION_IDS.includes(value as AgentSectionId)
}

export function agentSectionPath(section: AgentSectionId): string {
  return `/agent/${section}`
}
