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
import { describe, expect, test } from 'vitest'

import { alignToQuotaHour } from '../filters'
import { aggregateModelUsage, calculateDashboardStats } from '../stats'

describe('dashboard query time alignment', () => {
  test('floors the start timestamp to the quota_data hour bucket', () => {
    expect(
      alignToQuotaHour({ start_timestamp: 3700, end_timestamp: 8000 })
    ).toEqual({ start_timestamp: 3600, end_timestamp: 8000 })
  })

  test('keeps a non-positive start timestamp unchanged', () => {
    expect(
      alignToQuotaHour({ start_timestamp: 0, end_timestamp: 8000 })
    ).toEqual({ start_timestamp: 0, end_timestamp: 8000 })
  })
})

describe('dashboard token statistics', () => {
  test('aggregates input, output, and cached tokens without removing cache from input', () => {
    const stats = calculateDashboardStats([
      {
        created_at: 1,
        token_used: 150,
        prompt_tokens: 100,
        completion_tokens: 50,
        cache_tokens: 40,
      },
      {
        created_at: 2,
        token_used: 30,
        prompt_tokens: 20,
        completion_tokens: 10,
        cache_tokens: 5,
      },
    ])

    expect(stats.totalTokens).toBe(180)
    expect(stats.promptTokens).toBe(120)
    expect(stats.completionTokens).toBe(60)
    expect(stats.cacheTokens).toBe(45)
  })

  test('groups the filtered usage by model and sorts by call count', () => {
    const rows = aggregateModelUsage([
      {
        created_at: 1,
        model_name: 'gpt-a',
        count: 2,
        prompt_tokens: 100,
        completion_tokens: 20,
        cache_tokens: 10,
        quota: 300,
      },
      {
        created_at: 2,
        model_name: 'gpt-b',
        count: 5,
        prompt_tokens: 200,
        completion_tokens: 50,
        cache_tokens: 30,
        quota: 600,
      },
      {
        created_at: 3,
        model_name: 'gpt-a',
        count: 1,
        prompt_tokens: 40,
        completion_tokens: 10,
        cache_tokens: 5,
        quota: 100,
      },
    ])

    expect(rows).toEqual([
      {
        modelName: 'gpt-b',
        callCount: 5,
        promptTokens: 200,
        completionTokens: 50,
        cacheTokens: 30,
        quota: 600,
      },
      {
        modelName: 'gpt-a',
        callCount: 3,
        promptTokens: 140,
        completionTokens: 30,
        cacheTokens: 15,
        quota: 400,
      },
    ])
  })
})
