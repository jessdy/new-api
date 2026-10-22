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
export type ChannelModelCostPricing = Record<
  string,
  Record<string, number | string>
>

export function parseChannelCostPricing(
  value?: string | null
): ChannelModelCostPricing {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return {}
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    const result: ChannelModelCostPricing = {}
    for (const [modelName, raw] of Object.entries(
      parsed as Record<string, unknown>
    )) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
      result[modelName] = { ...(raw as Record<string, number | string>) }
    }
    return result
  } catch {
    return {}
  }
}

export function stringifyChannelCostPricing(
  pricing: ChannelModelCostPricing
): string {
  const entries = Object.entries(pricing).filter(
    ([modelName, values]) =>
      modelName.trim() !== '' && Object.keys(values).length > 0
  )
  if (entries.length === 0) return ''
  return JSON.stringify(Object.fromEntries(entries))
}

export function pruneChannelCostPricing(
  pricing: ChannelModelCostPricing,
  models: string[]
): ChannelModelCostPricing {
  const allowed = new Set(
    models.map((modelName) => modelName.trim()).filter(Boolean)
  )
  if (allowed.size === 0) return {}
  const next: ChannelModelCostPricing = {}
  for (const [modelName, values] of Object.entries(pricing)) {
    if (allowed.has(modelName)) {
      next[modelName] = values
    }
  }
  return next
}
