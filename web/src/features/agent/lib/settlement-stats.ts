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
import {
  formatBillingCurrencyFromUSD,
  getCurrencyDisplay,
} from '@/lib/currency'

import type { SettlementModelStat } from '../api'

const settlementMoneyOptions = {
  abbreviate: false,
  digitsLarge: 4,
  digitsSmall: 6,
} as const

export function formatSettlementAmount(quota: number): string {
  const { config } = getCurrencyDisplay()
  const perUnit = config.quotaPerUnit > 0 ? config.quotaPerUnit : 500000
  return formatBillingCurrencyFromUSD(quota / perUnit, settlementMoneyOptions)
}

export function formatSettlementUnitPrice(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '-'
  return formatBillingCurrencyFromUSD(value, settlementMoneyOptions)
}

function csvCell(value: string | number): string {
  const text = String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

export function buildSettlementStatementCsv(params: {
  periodStart: string
  periodEnd: string
  users: Array<{
    user_id: number
    username: string
    models: SettlementModelStat[]
  }>
  models: SettlementModelStat[]
  quota: number
  platformQuota: number
  channelQuota?: number
  labels: {
    title: string
    period: string
    userFees: string
    pending: string
    channelCost?: string
    perModel: string
    perUser: string
    model: string
    user: string
    input: string
    output: string
    cache: string
    inputPrice: string
    outputPrice: string
    cachePrice: string
    fee: string
  }
}): string {
  const labels = params.labels
  const includeChannelCost = Boolean(labels.channelCost)
  const price = (model: SettlementModelStat, kind: 'input' | 'output' | 'cache') => {
    if (model.per_call && kind === 'input') {
      return formatSettlementUnitPrice(model.unit_price)
    }
    if (kind === 'input') return formatSettlementUnitPrice(model.input_unit_price)
    if (kind === 'output') return formatSettlementUnitPrice(model.output_unit_price)
    return formatSettlementUnitPrice(model.cache_unit_price)
  }
  const lines: Array<Array<string | number>> = [
    [labels.title],
    [labels.period, params.periodStart, params.periodEnd],
    [labels.userFees, formatSettlementAmount(params.quota)],
    [labels.pending, formatSettlementAmount(params.platformQuota)],
  ]
  if (includeChannelCost) {
    lines.push([
      labels.channelCost ?? '',
      formatSettlementAmount(params.channelQuota ?? 0),
    ])
  }
  lines.push([])
  lines.push([labels.perModel])
  lines.push([
    labels.model,
    labels.input,
    labels.output,
    labels.cache,
    labels.inputPrice,
    labels.outputPrice,
    labels.cachePrice,
    labels.pending,
    ...(includeChannelCost ? [labels.channelCost ?? ''] : []),
  ])
  for (const model of params.models) {
    lines.push([
      model.model_name,
      model.prompt_tokens,
      model.completion_tokens,
      model.cache_tokens,
      price(model, 'input'),
      price(model, 'output'),
      price(model, 'cache'),
      formatSettlementAmount(model.platform_quota),
      ...(includeChannelCost
        ? [formatSettlementAmount(model.channel_quota ?? 0)]
        : []),
    ])
  }
  lines.push([])
  lines.push([labels.perUser])
  lines.push([
    labels.user,
    labels.model,
    labels.input,
    labels.output,
    labels.cache,
    labels.inputPrice,
    labels.outputPrice,
    labels.cachePrice,
    labels.fee,
    labels.pending,
    ...(includeChannelCost ? [labels.channelCost ?? ''] : []),
  ])
  for (const user of params.users) {
    const label = `#${user.user_id} ${user.username}`.trim()
    for (const model of user.models) {
      lines.push([
        label,
        model.model_name,
        model.prompt_tokens,
        model.completion_tokens,
        model.cache_tokens,
        price(model, 'input'),
        price(model, 'output'),
        price(model, 'cache'),
        formatSettlementAmount(model.quota),
        formatSettlementAmount(model.platform_quota),
        ...(includeChannelCost
          ? [formatSettlementAmount(model.channel_quota ?? 0)]
          : []),
      ])
    }
  }
  return `\uFEFF${lines.map((row) => row.map(csvCell).join(',')).join('\n')}\n`
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
