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
import type { SettlementModelStat } from '../api'

export function settlementPendingQuota(row: {
  quota: number
  platform_quota: number
}): number {
  if (row.platform_quota > 0) return row.platform_quota
  return row.quota
}

export function formatSettlementUnitPrice(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '-'
  return Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(
    value
  )
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
}): string {
  const lines = [
    ['Settlement statement'],
    ['Period', params.periodStart, params.periodEnd],
    ['User fees', params.quota],
    ['Pending settlement amount', params.platformQuota],
    [],
    ['Per-model statistics'],
    [
      'Model',
      'Input Tokens',
      'Output Tokens',
      'Cache Tokens',
      'Unit price',
      'Pending settlement amount',
    ],
  ]
  for (const model of params.models) {
    lines.push([
      model.model_name,
      model.prompt_tokens,
      model.completion_tokens,
      model.cache_tokens,
      model.unit_price,
      settlementPendingQuota(model),
    ])
  }
  lines.push([])
  lines.push(['Per-user details'])
  lines.push([
    'User',
    'Model',
    'Input Tokens',
    'Output Tokens',
    'Cache Tokens',
    'Unit price',
    'Fee',
    'Pending settlement amount',
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
        model.unit_price,
        model.quota,
        settlementPendingQuota(model),
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
