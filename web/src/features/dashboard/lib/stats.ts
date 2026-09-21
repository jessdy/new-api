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
import type { QuotaDataItem } from '@/features/dashboard/types'

export interface ModelUsageSummary {
  modelName: string
  callCount: number
  promptTokens: number
  completionTokens: number
  cacheTokens: number
  quota: number
}

/**
 * Safe division: handles NaN and Infinity cases
 */
export function safeDivide(
  value: number,
  divisor: number,
  precision: number = 3
): number {
  const result = value / divisor
  if (Number.isNaN(result) || !Number.isFinite(result)) return 0
  const factor = Math.pow(10, precision)
  return Math.round(result * factor) / factor
}

/**
 * Calculate aggregated statistics from quota data
 */
export function calculateDashboardStats(data: QuotaDataItem[]) {
  return data.reduce(
    (acc, item) => ({
      totalQuota: acc.totalQuota + (Number(item.quota) || 0),
      totalCount: acc.totalCount + (Number(item.count) || 0),
      totalTokens: acc.totalTokens + (Number(item.token_used) || 0),
      promptTokens: acc.promptTokens + (Number(item.prompt_tokens) || 0),
      completionTokens:
        acc.completionTokens + (Number(item.completion_tokens) || 0),
      cacheTokens: acc.cacheTokens + (Number(item.cache_tokens) || 0),
    }),
    {
      totalQuota: 0,
      totalCount: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      cacheTokens: 0,
    }
  )
}

export function aggregateModelUsage(
  data: QuotaDataItem[]
): ModelUsageSummary[] {
  const usageByModel = new Map<string, ModelUsageSummary>()

  for (const item of data) {
    const modelName = item.model_name?.trim() || '—'
    const current = usageByModel.get(modelName) ?? {
      modelName,
      callCount: 0,
      promptTokens: 0,
      completionTokens: 0,
      cacheTokens: 0,
      quota: 0,
    }
    current.callCount += Number(item.count) || 0
    current.promptTokens += Number(item.prompt_tokens) || 0
    current.completionTokens += Number(item.completion_tokens) || 0
    current.cacheTokens += Number(item.cache_tokens) || 0
    current.quota += Number(item.quota) || 0
    usageByModel.set(modelName, current)
  }

  return [...usageByModel.values()].sort(
    (left, right) =>
      right.callCount - left.callCount ||
      right.quota - left.quota ||
      left.modelName.localeCompare(right.modelName)
  )
}

export interface ConsumeLogTokenTotal {
  model_name: string
  prompt_tokens: number
  completion_tokens: number
  cache_tokens: number
}

export function applyConsumeLogTokenTotals(
  data: QuotaDataItem[],
  totals: ConsumeLogTokenTotal[]
): QuotaDataItem[] {
  const totalsByModel = new Map(
    totals.map((item) => [item.model_name.trim() || '—', item])
  )
  const assigned = new Set<string>()
  return data.map((item) => {
    const modelName = item.model_name?.trim() || '—'
    const total = totalsByModel.get(modelName)
    if (!total) {
      return {
        ...item,
        prompt_tokens: 0,
        completion_tokens: 0,
        cache_tokens: 0,
        token_used: 0,
      }
    }
    if (assigned.has(modelName)) {
      return {
        ...item,
        prompt_tokens: 0,
        completion_tokens: 0,
        cache_tokens: 0,
        token_used: 0,
      }
    }
    assigned.add(modelName)
    const promptTokens = Number(total.prompt_tokens) || 0
    const completionTokens = Number(total.completion_tokens) || 0
    return {
      ...item,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      cache_tokens: Number(total.cache_tokens) || 0,
      token_used: promptTokens + completionTokens,
    }
  })
}
