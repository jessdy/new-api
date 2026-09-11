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
  enabled: boolean
  is_default: boolean
}

export type AgentModelPrice = {
  agent_id?: number
  model: string
  discount_ratio: number
}

export type AgentUser = {
  id: number
  username: string
  display_name: string
  status: number
  group: string
  quota: number
  used_quota: number
}

export type AgentPaymentConfigView = {
  epay_enabled: boolean
  pay_address: string
  epay_id: string
  epay_key_set: boolean
  pay_methods: Array<Record<string, string>>
  stripe_enabled: boolean
  stripe_api_secret_set: boolean
  stripe_webhook_secret_set: boolean
  stripe_price_id: string
  stripe_unit_price: number
  stripe_min_topup: number
}

export async function getAgentSelf(): Promise<AgentSummary> {
  const res = await api.get('/api/agent/self')
  requireServerSuccess(res.data, 'Failed to load agent profile')
  return res.data.data
}

export async function listAgentChannels(): Promise<AgentChannelItem[]> {
  const res = await api.get('/api/agent/channels')
  requireServerSuccess(res.data, 'Failed to load channels')
  return res.data.data ?? []
}

export async function replaceAgentChannels(channelIds: number[]): Promise<void> {
  const res = await api.put('/api/agent/channels', { channel_ids: channelIds })
  requireServerSuccess(res.data, 'Failed to save channels')
}

export async function listAgentGroups(): Promise<AgentGroup[]> {
  const res = await api.get('/api/agent/groups')
  requireServerSuccess(res.data, 'Failed to load groups')
  return res.data.data ?? []
}

export async function upsertAgentGroup(group: AgentGroup): Promise<void> {
  const res = await api.put('/api/agent/groups', group)
  requireServerSuccess(res.data, 'Failed to save group')
}

export async function listAgentModelPrices(): Promise<AgentModelPrice[]> {
  const res = await api.get('/api/agent/model-prices')
  requireServerSuccess(res.data, 'Failed to load model prices')
  return res.data.data ?? []
}

export async function upsertAgentModelPrice(
  price: AgentModelPrice
): Promise<void> {
  const res = await api.put('/api/agent/model-prices', price)
  requireServerSuccess(res.data, 'Failed to save model price')
}

export async function listAgentUsers(page = 1, pageSize = 20) {
  const res = await api.get('/api/agent/users', {
    params: { p: page, page_size: pageSize },
  })
  requireServerSuccess(res.data, 'Failed to load agent users')
  return res.data.data as {
    items: AgentUser[]
    total: number
    page: number
    page_size: number
  }
}

export async function getAgentPaymentConfig(): Promise<AgentPaymentConfigView> {
  const res = await api.get('/api/agent/payment')
  requireServerSuccess(res.data, 'Failed to load payment config')
  return res.data.data
}

export async function updateAgentPaymentConfig(
  payload: Record<string, unknown>
): Promise<AgentPaymentConfigView> {
  const res = await api.put('/api/agent/payment', payload)
  requireServerSuccess(res.data, 'Failed to save payment config')
  return res.data.data
}

export async function listAgentSettlement() {
  const res = await api.get('/api/agent/settlement')
  requireServerSuccess(res.data, 'Failed to load settlement')
  return res.data.data as {
    items: Array<Record<string, unknown>>
    total: number
    settlement_debt: number
    credit_limit: number
  }
}

export async function adminListAgents(page = 1, pageSize = 20, status = '') {
  const res = await api.get('/api/agents/', {
    params: { p: page, page_size: pageSize, status },
  })
  requireServerSuccess(res.data, 'Failed to load agents')
  return res.data.data as {
    items: AgentSummary[]
    total: number
    page: number
    page_size: number
  }
}

export async function adminCreateAgent(payload: {
  user_id: number
  name: string
  invite_code?: string
  credit_limit?: number
  status?: string
}): Promise<AgentSummary> {
  const res = await api.post('/api/agents/', payload)
  requireServerSuccess(res.data, 'Failed to create agent')
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
  requireServerSuccess(res.data, 'Failed to update agent')
  return res.data.data
}

export async function adminCreateSettlementBill(
  agentId: number,
  payload: { period_start: number; period_end: number; platform_quota?: number }
) {
  const res = await api.post(`/api/agents/${agentId}/settlement-bills`, payload)
  requireServerSuccess(res.data, 'Failed to create settlement bill')
  return res.data.data
}

export async function adminMarkSettlementBillPaid(billId: number) {
  const res = await api.post(`/api/agents/settlement-bills/${billId}/paid`)
  requireServerSuccess(res.data, 'Failed to mark bill paid')
}
