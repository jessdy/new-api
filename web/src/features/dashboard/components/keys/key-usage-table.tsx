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
import { useQuery } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { KeyRound } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  StaticDataTable,
  staticDataTableClassNames,
  type StaticDataTableColumn,
} from '@/components/data-table'
import { IconBadge } from '@/components/ui/icon-badge'
import { getUserTokenModelUsage } from '@/features/dashboard/api'
import { getDashboardQueryTimeRange } from '@/features/dashboard/lib/filters'
import type {
  DashboardFilters,
  UserTokenUsageItem,
} from '@/features/dashboard/types'
import { formatNumber, formatQuota } from '@/lib/format'
import { getLobeIcon } from '@/lib/lobe-icon'
import { requireServerSuccess } from '@/lib/server-error-message'

interface KeyUsageTableProps {
  filters?: DashboardFilters
}

interface KeyUsageRow {
  rowKey: string
  tokenLabel: string
  deleted: boolean
  modelName: string
  callCount: number
  promptTokens: number
  completionTokens: number
  cacheTokens: number
  quota: number
}

function tokenLabel(item: UserTokenUsageItem, t: TFunction) {
  if (item.token_id === 0) return t('Unknown key')
  if (item.token_name) return item.token_name
  return t('Deleted ({{id}})', { id: item.token_id })
}

function usageRows(items: UserTokenUsageItem[], t: TFunction): KeyUsageRow[] {
  const rows: KeyUsageRow[] = []
  for (const item of items) {
    const label = tokenLabel(item, t)
    const models = item.models ?? []
    if (models.length === 0) {
      rows.push({
        rowKey: `${item.token_id}:empty`,
        tokenLabel: label,
        deleted: item.deleted,
        modelName: '—',
        callCount: 0,
        promptTokens: 0,
        completionTokens: 0,
        cacheTokens: 0,
        quota: 0,
      })
      continue
    }
    for (const model of models) {
      rows.push({
        rowKey: `${item.token_id}:${model.model_name}`,
        tokenLabel: label,
        deleted: item.deleted,
        modelName: model.model_name || '—',
        callCount: model.count,
        promptTokens: model.prompt_tokens,
        completionTokens: model.completion_tokens,
        cacheTokens: model.cache_tokens,
        quota: model.quota,
      })
    }
  }
  return rows
}

export function KeyUsageTable(props: KeyUsageTableProps) {
  const { t } = useTranslation()
  const timeRange = getDashboardQueryTimeRange(props.filters)
  const query = useQuery({
    queryKey: ['dashboard', 'token-usage', timeRange],
    queryFn: async () =>
      requireServerSuccess(await getUserTokenModelUsage(timeRange)),
  })
  const rows = useMemo(
    () => usageRows(query.data?.data ?? [], t),
    [query.data?.data, t]
  )
  const columns = useMemo<StaticDataTableColumn<KeyUsageRow>[]>(
    () => [
      {
        id: 'key',
        header: t('Key'),
        cell: (row) => (
          <div className='flex min-w-36 items-center gap-2'>
            <span className='text-sm break-all'>{row.tokenLabel}</span>
            {row.deleted ? (
              <span className='text-muted-foreground shrink-0 text-xs'>
                {t('Deleted key')}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'model',
        header: t('Model'),
        cell: (row) => (
          <div className='flex min-w-40 items-center gap-2.5'>
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
          <span className='font-semibold tabular-nums'>
            {formatQuota(row.quota)}
          </span>
        ),
      },
    ],
    [t]
  )

  let emptyContent = t('No data')
  if (query.isLoading) emptyContent = t('Loading')
  if (query.isError) emptyContent = t('Failed to load')

  return (
    <section className='overflow-hidden rounded-lg border'>
      <div className='flex items-center gap-2 border-b px-3 py-2 sm:px-5 sm:py-3'>
        <IconBadge tone='chart-2' size='sm'>
          <KeyRound />
        </IconBadge>
        <h2 className='text-sm font-semibold'>{t('Usage by Key')}</h2>
      </div>
      <StaticDataTable
        className={staticDataTableClassNames.embeddedContainer}
        columns={columns}
        data={query.isLoading || query.isError ? [] : rows}
        getRowKey={(row) => row.rowKey}
        empty={query.isLoading || query.isError || rows.length === 0}
        emptyContent={emptyContent}
        headerRowClassName={staticDataTableClassNames.mutedHeaderRow}
      />
    </section>
  )
}
