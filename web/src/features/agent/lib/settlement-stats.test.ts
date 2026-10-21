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
  formatSettlementAmount,
} from './settlement-stats'

const labels = {
  title: 'Settlement statement',
  period: 'Period',
  userFees: 'User fees',
  pending: 'Pending settlement amount',
  perModel: 'Per-model statistics',
  perUser: 'Per-user details',
  model: 'Model',
  user: 'User',
  input: 'Input Tokens',
  output: 'Output Tokens',
  cache: 'Cache Tokens',
  inputPrice: 'Input unit price',
  outputPrice: 'Output unit price',
  cachePrice: 'Cache unit price',
  fee: 'Fee',
}

test('settlement statement csv uses currency amounts that match the fee', () => {
  const csv = buildSettlementStatementCsv({
    periodStart: '2026-10-14 00:00:00',
    periodEnd: '2026-10-20 10:00:00',
    quota: 500000,
    platformQuota: 250000,
    labels,
    models: [
      {
        model_name: 'gpt-4.1',
        count: 1,
        prompt_tokens: 6,
        completion_tokens: 2,
        cache_tokens: 2,
        unit_price: 2,
        input_unit_price: 2,
        output_unit_price: 4,
        cache_unit_price: 1,
        quota: 500000,
        platform_quota: 250000,
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
            prompt_tokens: 6,
            completion_tokens: 2,
            cache_tokens: 2,
            unit_price: 2,
            input_unit_price: 2,
            output_unit_price: 4,
            cache_unit_price: 1,
            quota: 500000,
            platform_quota: 250000,
          },
        ],
      },
    ],
  })
  const fee = formatSettlementAmount(500000)
  const pending = formatSettlementAmount(250000)
  expect(csv).toContain('Settlement statement')
  expect(csv).toContain('#601 settle-user')
  expect(csv).toContain(fee)
  expect(csv).toContain(pending)
  expect(csv).not.toContain(',500000,')
  expect(csv).not.toContain(',250000,')
  expect(csv.split(pending).length - 1).toBeGreaterThan(1)
})
