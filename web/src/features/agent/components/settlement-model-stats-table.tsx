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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  StaticDataTable,
  staticDataTableClassNames,
  type StaticDataTableColumn,
} from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { formatNumber, formatQuota } from '@/lib/format'

import type { SettlementModelStat } from '../api'
import { formatSettlementUnitPrice } from '../lib/settlement-stats'

export function SettlementModelStatsTable(props: {
  models: SettlementModelStat[]
  amountMode: 'fee' | 'pending'
  emptyTitle?: string
}) {
  const { t } = useTranslation()
  const amountHeader =
    props.amountMode === 'fee' ? t('Fee') : t('Pending settlement amount')
  const columns = useMemo<StaticDataTableColumn<SettlementModelStat>[]>(
    () => [
      {
        id: 'model',
        header: t('Model'),
        cell: (row) => (
          <span className='font-mono text-sm break-all'>
            {row.model_name || '—'}
          </span>
        ),
      },
      {
        id: 'input',
        header: t('Input Tokens'),
        className: staticDataTableClassNames.compactHeaderCellRight,
        cellClassName: staticDataTableClassNames.compactNumericCell,
        cell: (row) => formatNumber(row.prompt_tokens),
      },
      {
        id: 'output',
        header: t('Output Tokens'),
        className: staticDataTableClassNames.compactHeaderCellRight,
        cellClassName: staticDataTableClassNames.compactNumericCell,
        cell: (row) => formatNumber(row.completion_tokens),
      },
      {
        id: 'cache',
        header: t('Cache Tokens'),
        className: staticDataTableClassNames.compactHeaderCellRight,
        cellClassName: staticDataTableClassNames.compactNumericCell,
        cell: (row) => formatNumber(row.cache_tokens),
      },
      {
        id: 'input-price',
        header: t('Input unit price'),
        className: staticDataTableClassNames.compactHeaderCellRight,
        cellClassName: staticDataTableClassNames.compactNumericCell,
        cell: (row) =>
          formatSettlementUnitPrice(
            row.per_call ? row.unit_price : row.input_unit_price
          ),
      },
      {
        id: 'output-price',
        header: t('Output unit price'),
        className: staticDataTableClassNames.compactHeaderCellRight,
        cellClassName: staticDataTableClassNames.compactNumericCell,
        cell: (row) =>
          row.per_call ? '-' : formatSettlementUnitPrice(row.output_unit_price),
      },
      {
        id: 'cache-price',
        header: t('Cache unit price'),
        className: staticDataTableClassNames.compactHeaderCellRight,
        cellClassName: staticDataTableClassNames.compactNumericCell,
        cell: (row) =>
          row.per_call ? '-' : formatSettlementUnitPrice(row.cache_unit_price),
      },
      {
        id: 'amount',
        header: amountHeader,
        className: staticDataTableClassNames.compactHeaderCellRight,
        cellClassName: staticDataTableClassNames.compactNumericCell,
        cell: (row) => (
          <span className='font-semibold tabular-nums'>
            {formatQuota(
              props.amountMode === 'fee' ? row.quota : row.platform_quota
            )}
          </span>
        ),
      },
    ],
    [amountHeader, props.amountMode, t]
  )

  if (props.models.length === 0) {
    return (
      <EmptyState title={props.emptyTitle ?? t('No per-model statistics')} />
    )
  }

  return (
    <StaticDataTable
      className={staticDataTableClassNames.embeddedContainer}
      tableClassName={staticDataTableClassNames.compactTable}
      columns={columns}
      data={props.models}
      getRowKey={(row, index) => `${row.model_name}-${index}`}
      headerRowClassName={staticDataTableClassNames.mutedHeaderRow}
    />
  )
}
