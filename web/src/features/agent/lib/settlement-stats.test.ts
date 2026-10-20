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
*/
import { expect, test } from 'vitest'

import {
  buildSettlementStatementCsv,
  settlementPendingQuota,
} from './settlement-stats'

test('pending quota uses platform quota when present', () => {
  expect(settlementPendingQuota({ quota: 20, platform_quota: 7 })).toBe(7)
  expect(settlementPendingQuota({ quota: 20, platform_quota: 0 })).toBe(20)
})

test('settlement statement csv includes per-model and per-user rows', () => {
  const csv = buildSettlementStatementCsv({
    periodStart: '2026-10-14 00:00:00',
    periodEnd: '2026-10-20 10:00:00',
    quota: 30,
    platformQuota: 13,
    models: [
      {
        model_name: 'gpt-4.1',
        count: 1,
        prompt_tokens: 8,
        completion_tokens: 2,
        cache_tokens: 2,
        unit_price: 1.5,
        quota: 20,
        platform_quota: 4,
      },
    ],
    users: [
      {
        user_id: 601,
        username: 'settle-user',
        models: [
          {
            model_name: 'gpt-4.1',
            count: 1,
            prompt_tokens: 8,
            completion_tokens: 2,
            cache_tokens: 2,
            unit_price: 1.5,
            quota: 20,
            platform_quota: 4,
          },
        ],
      },
    ],
  })
  expect(csv).toContain('Settlement statement')
  expect(csv).toContain('gpt-4.1')
  expect(csv).toContain('#601 settle-user')
  expect(csv).toContain('Pending settlement amount')
  expect(csv).toContain('1.5')
})
