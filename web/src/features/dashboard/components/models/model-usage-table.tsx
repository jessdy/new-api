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
import { ListTree } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  StaticDataTable,
  staticDataTableClassNames,
  type StaticDataTableColumn,
} from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { IconBadge } from '@/components/ui/icon-badge'
import { getDashboardQueryTimeRange } from '@/features/dashboard/lib/filters'
import {
  aggregateModelUsage,
  type ModelUsageSummary,
} from '@/features/dashboard/lib/stats'
import type {
  DashboardFilters,
  QuotaDataItem,
} from '@/features/dashboard/types'
import { formatNumber, formatQuota } from '@/lib/format'
import { getLobeIcon } from '@/lib/lobe-icon'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { ModelBillingDetailsDialog } from './model-billing-details-dialog'

interface ModelUsageTableProps {
  data: QuotaDataItem[]
  loading?: boolean
  filters?: DashboardFilters
  aggregateAgent?: boolean
}

export function ModelUsageTable(props: ModelUsageTableProps) {
  const { t } = useTranslation()
  const userRole = useAuthStore((state) => state.auth.user?.role)
  const [billingRow, setBillingRow] = useState<ModelUsageSummary | null>(null)
  const timeRange = getDashboardQueryTimeRange(props.filters)
  let billingScope: 'admin' | 'agent' | 'self' = 'self'
  if (userRole != null && userRole >= ROLE.ADMIN) {
    billingScope = 'admin'
  } else if (props.aggregateAgent) {
    billingScope = 'agent'
  }
  const rows = useMemo(
    () => (props.loading ? [] : aggregateModelUsage(props.data)),
    [props.data, props.loading]
  )
  const columns = useMemo<StaticDataTableColumn<ModelUsageSummary>[]>(
    () => [
      {
        id: 'model',
        header: t('Model'),
        cell: (row) => (
          <div className='flex min-w-48 items-center gap-2.5'>
            <span className='flex size-6 shrink-0 items-center justify-center'>
              {row.modelName === '—' ? null : getLobeIcon(row.modelName, 24)}
            </span>
            <span className='font-mono text-sm break-all'>{row.modelName}</span>
          </div>
        ),
      },
      {
        id: 'calls',
        header: t('Call Count'),
        className: staticDataTableClassNames.compactHeaderCellRight,
        cellClassName: staticDataTableClassNames.compactNumericCell,
        cell: (row) => formatNumber(row.callCount),
      },
      {
        id: 'input',
        header: t('Input Tokens'),
        className: staticDataTableClassNames.compactHeaderCellRight,
        cellClassName: staticDataTableClassNames.compactNumericCell,
        cell: (row) => formatNumber(row.promptTokens),
      },
      {
        id: 'output',
        header: t('Output Tokens'),
        className: staticDataTableClassNames.compactHeaderCellRight,
        cellClassName: staticDataTableClassNames.compactNumericCell,
        cell: (row) => formatNumber(row.completionTokens),
      },
      {
        id: 'cache',
        header: t('Cache Tokens'),
        className: staticDataTableClassNames.compactHeaderCellRight,
        cellClassName: staticDataTableClassNames.compactNumericCell,
        cell: (row) => formatNumber(row.cacheTokens),
      },
      {
        id: 'billing',
        header: t('Billing'),
        className: staticDataTableClassNames.compactHeaderCellRight,
        cellClassName: staticDataTableClassNames.compactNumericCell,
        cell: (row) => (
          <Button
            variant='link'
            size='sm'
            className='h-auto p-0 font-semibold tabular-nums underline decoration-dotted underline-offset-4'
            aria-label={`${t('Billing Details')}: ${row.modelName}`}
            onClick={() => setBillingRow(row)}
          >
            {formatQuota(row.quota)}
          </Button>
        ),
      },
    ],
    [t]
  )

  return (
    <section className='overflow-hidden rounded-lg border'>
      <div className='flex items-center gap-2 border-b px-3 py-2 sm:px-5 sm:py-3'>
        <IconBadge tone='chart-2' size='sm'>
          <ListTree />
        </IconBadge>
        <h2 className='text-sm font-semibold'>{t('Model Usage')}</h2>
      </div>
      <StaticDataTable
        className={staticDataTableClassNames.embeddedContainer}
        columns={columns}
        data={rows}
        getRowKey={(row) => row.modelName}
        empty={props.loading || rows.length === 0}
        emptyContent={t(props.loading ? 'Loading' : 'No data')}
        headerRowClassName={staticDataTableClassNames.mutedHeaderRow}
      />
      {billingRow ? (
        <ModelBillingDetailsDialog
          key={billingRow.modelName}
          modelName={billingRow.modelName}
          promptTokens={billingRow.promptTokens}
          completionTokens={billingRow.completionTokens}
          cacheTokens={billingRow.cacheTokens}
          quota={billingRow.quota}
          startTimestamp={timeRange.start_timestamp}
          endTimestamp={timeRange.end_timestamp}
          scope={billingScope}
          isRoot={userRole === ROLE.SUPER_ADMIN}
          username={
            billingScope === 'admin' ? props.filters?.username : undefined
          }
          open
          onOpenChange={(open) => {
            if (!open) setBillingRow(null)
          }}
        />
      ) : null}
    </section>
  )
}
