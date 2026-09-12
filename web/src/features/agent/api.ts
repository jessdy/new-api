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
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

function agentParams(agentId?: number) {
  return agentId && agentId > 0 ? { agent_id: agentId } : undefined
}

export type AgentSummary = {
  id: number
  user_id: number
  name: string
  invite_code: string
  status: string
  credit_limit: number
  settlement_debt: number
  request_allowed?: boolean
  created_at?: number
  updated_at?: number
}

export type AgentChannelItem = {
  id: number
  name: string
  type: number
  models: string[]
  group: string
  status: number
  priority: number
  weight: number
  selected: boolean
}

export type AgentGroup = {
  id?: number
  agent_id?: number
  name: string
  ratio: number
  topup_ratio: number
  description?: string
  selectable?: boolean
  enabled: boolean
  is_default: boolean
}

export type AgentGroupPricingView = {
  group_ratio: Record<string, number>
  topup_group_ratio: Record<string, number>
  user_usable_groups: Record<string, string>
  group_group_ratio: Record<string, Record<string, number>>
  auto_groups: string[]
  max_token_auto_groups: number
  default_use_auto_group: boolean
  group_special_usable_group: Record<string, Record<string, string>>
}

export type AgentModelPrice = {
  agent_id?: number
  model: string
  discount_ratio: number
}

export type AgentMemberRole = 'user' | 'sales'

export type AgentUser = {
  id: number
  username: string
  display_name: string
  status: number
  group: string
  quota: number
  used_quota: number
  aff_code?: string
  inviter_id?: number
  inviter_username?: string
  agent_member_role?: AgentMemberRole
}

export type AgentPaymentConfigView = {
  price: number
  min_topup: number
  amount_options: number[]
  amount_discount: Record<string, number>
  epay_enabled: boolean
  pay_address: string
  custom_callback_address: string
  epay_id: string
  epay_id_set: boolean
  epay_key_set: boolean
  pay_methods: Array<Record<string, string>>
  stripe_enabled: boolean
  stripe_api_secret_set: boolean
  stripe_webhook_secret_set: boolean
  stripe_price_id: string
  stripe_unit_price: number
  stripe_min_topup: number
  stripe_promotion_codes_enabled: boolean
}

export async function getAgentSelf(agentId?: number): Promise<AgentSummary> {
  const res = await api.get('/api/agent/self', { params: agentParams(agentId) })
  requireServerSuccess(res.data)
  return res.data.data
}

export async function listAgentChannels(
  agentId?: number
): Promise<AgentChannelItem[]> {
  const res = await api.get('/api/agent/channels', {
    params: agentParams(agentId),
  })
  requireServerSuccess(res.data)
  return res.data.data ?? []
}

export async function replaceAgentChannels(
  channelIds: number[],
  agentId?: number
): Promise<void> {
  const res = await api.put(
    '/api/agent/channels',
    { channel_ids: channelIds },
    { params: agentParams(agentId) }
  )
  requireServerSuccess(res.data)
}

export async function listAgentGroups(
  agentId?: number
): Promise<AgentGroupPricingView> {
  const res = await api.get('/api/agent/groups', { params: agentParams(agentId) })
  requireServerSuccess(res.data)
  return (
    res.data.data ?? {
      group_ratio: {},
      topup_group_ratio: {},
      user_usable_groups: {},
      group_group_ratio: {},
      auto_groups: [],
      max_token_auto_groups: 0,
      default_use_auto_group: false,
      group_special_usable_group: {},
    }
  )
}

export async function upsertAgentGroup(
  pricing: AgentGroupPricingView,
  agentId?: number
): Promise<AgentGroupPricingView> {
  const res = await api.put('/api/agent/groups', pricing, {
    params: agentParams(agentId),
  })
  requireServerSuccess(res.data)
  return res.data.data
}

export async function listAgentModelPrices(
  agentId?: number
): Promise<AgentModelPrice[]> {
  const res = await api.get('/api/agent/model-prices', {
    params: agentParams(agentId),
  })
  requireServerSuccess(res.data)
  return res.data.data ?? []
}

export async function upsertAgentModelPrice(
  price: AgentModelPrice,
  agentId?: number
): Promise<void> {
  const res = await api.put('/api/agent/model-prices', price, {
    params: agentParams(agentId),
  })
  requireServerSuccess(res.data)
}

export async function listAgentUsers(
  page = 1,
  pageSize = 20,
  agentId?: number
) {
  const res = await api.get('/api/agent/users', {
    params: { p: page, page_size: pageSize, ...agentParams(agentId) },
  })
  requireServerSuccess(res.data)
  return res.data.data as {
    items: AgentUser[]
    total: number
    page: number
    page_size: number
  }
}

export async function updateAgentUser(
  userId: number,
  payload: { agent_member_role?: AgentMemberRole; group?: string; status?: number },
  agentId?: number
): Promise<void> {
  const res = await api.put(`/api/agent/users/${userId}`, payload, {
    params: agentParams(agentId),
  })
  requireServerSuccess(res.data)
}

export async function getAgentPaymentConfig(
  agentId?: number
): Promise<AgentPaymentConfigView> {
  const res = await api.get('/api/agent/payment', {
    params: agentParams(agentId),
  })
  requireServerSuccess(res.data)
  return res.data.data
}

export async function updateAgentPaymentConfig(
  payload: Record<string, unknown>,
  agentId?: number
): Promise<AgentPaymentConfigView> {
  const res = await api.put('/api/agent/payment', payload, {
    params: agentParams(agentId),
  })
  requireServerSuccess(res.data)
  return res.data.data
}

export async function listAgentSettlement(agentId?: number) {
  const res = await api.get('/api/agent/settlement', {
    params: agentParams(agentId),
  })
  requireServerSuccess(res.data)
  return res.data.data as {
    items: Array<Record<string, unknown>>
    total: number
    settlement_debt: number
    credit_limit: number
  }
}

export async function adminListAgents(
  page = 1,
  pageSize = 20,
  status = '',
  userId?: number
) {
  const res = await api.get('/api/agents/', {
    params: {
      p: page,
      page_size: pageSize,
      status,
      ...(userId && userId > 0 ? { user_id: userId } : {}),
    },
  })
  requireServerSuccess(res.data)
  return res.data.data as {
    items: AgentSummary[]
    total: number
    page: number
    page_size: number
  }
}

export async function adminCreateAgent(payload: {
  user_id?: number
  username?: string
  name: string
  invite_code?: string
  credit_limit?: number
  status?: string
}): Promise<AgentSummary> {
  const res = await api.post('/api/agents/', payload)
  requireServerSuccess(res.data)
  return res.data.data
}

export async function adminUpdateAgent(
  id: number,
  payload: {
    name?: string
    status?: string
    credit_limit?: number
    invite_code?: string
  }
): Promise<AgentSummary> {
  const res = await api.put(`/api/agents/${id}`, payload)
  requireServerSuccess(res.data)
  return res.data.data
}

export async function adminCreateSettlementBill(
  agentId: number,
  payload: { period_start: number; period_end: number; platform_quota?: number }
) {
  const res = await api.post(`/api/agents/${agentId}/settlement-bills`, payload)
  requireServerSuccess(res.data)
  return res.data.data
}

export async function adminMarkSettlementBillPaid(billId: number) {
  const res = await api.post(`/api/agents/settlement-bills/${billId}/paid`)
  requireServerSuccess(res.data)
}
