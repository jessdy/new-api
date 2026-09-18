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
along with this program. If you did not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  StaticDataTable,
  type StaticDataTableColumn,
} from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { CompactDateTimeRangePicker } from '@/features/usage-logs/components/compact-date-time-range-picker'
import { formatNumber, formatQuota } from '@/lib/format'

import {
  getAgentSettlementUsage,
  listAgentSettlement,
  type AgentSettlementUsageUser,
} from '../api'

function defaultSettlementRange() {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 6)
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

export function AgentSettlementPanel(props: { agentId?: number }) {
  const { t } = useTranslation()
  const [range, setRange] = useState(defaultSettlementRange)
  const startTimestamp = range.start
    ? Math.floor(range.start.getTime() / 1000)
    : 0
  const endTimestamp = range.end ? Math.floor(range.end.getTime() / 1000) : 0

  const settlementQuery = useQuery({
    queryKey: ['agent', 'settlement', props.agentId],
    queryFn: () => listAgentSettlement(props.agentId),
  })
  const usageQuery = useQuery({
    queryKey: [
      'agent',
      'settlement-usage',
      props.agentId,
      startTimestamp,
      endTimestamp,
    ],
    queryFn: () =>
      getAgentSettlementUsage(startTimestamp, endTimestamp, props.agentId),
    enabled: startTimestamp > 0 && endTimestamp >= startTimestamp,
  })

  const columns = useMemo<StaticDataTableColumn<AgentSettlementUsageUser>[]>(
    () => [
      {
        id: 'user',
        header: t('User'),
        cell: (row) => (
          <span className='font-medium'>
            #{row.user_id} {row.username}
          </span>
        ),
      },
      {
        id: 'count',
        header: t('Requests'),
        cell: (row) => formatNumber(row.count),
      },
      {
        id: 'tokens',
        header: t('Tokens'),
        cell: (row) => formatNumber(row.token_used),
      },
      {
        id: 'quota',
        header: t('User fees'),
        cell: (row) => formatQuota(row.quota),
      },
      {
        id: 'cost',
        header: t('Channel cost'),
        cell: (row) => formatQuota(row.platform_quota),
      },
    ],
    [t]
  )

  const usage = usageQuery.data
  const margin = (usage?.quota ?? 0) - (usage?.platform_quota ?? 0)

  return (
    <div className='space-y-6'>
      <div className='text-sm'>
        {t('Settlement debt')}: {settlementQuery.data?.settlement_debt ?? 0} /{' '}
        {t('Credit limit')}: {settlementQuery.data?.credit_limit ?? 0}
      </div>

      <div className='space-y-3'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <h2 className='text-sm font-medium'>{t('Channel usage')}</h2>
            <p className='text-muted-foreground text-xs'>
              {t(
                'Usage for users on your current channels in the selected time range.'
              )}
            </p>
          </div>
          <CompactDateTimeRangePicker
            start={range.start}
            end={range.end}
            onChange={(next) =>
              setRange({
                start: next.start ?? range.start,
                end: next.end ?? range.end,
              })
            }
          />
        </div>

        {usageQuery.isLoading ? <LoadingState /> : null}
        {usageQuery.isError ? (
          <ErrorState
            title={t('Failed to load settlement usage')}
            onRetry={() => {
              void usageQuery.refetch()
            }}
          />
        ) : null}
        {usage ? (
          <div className='space-y-4'>
            <div className='grid gap-3 sm:grid-cols-3'>
              <div className='rounded-md border p-3'>
                <div className='text-muted-foreground text-xs'>
                  {t('User fees')}
                </div>
                <div className='text-lg font-medium'>
                  {formatQuota(usage.quota)}
                </div>
                <div className='text-muted-foreground text-xs'>
                  {formatNumber(usage.count)} {t('Requests')}
                </div>
              </div>
              <div className='rounded-md border p-3'>
                <div className='text-muted-foreground text-xs'>
                  {t('Channel cost')}
                </div>
                <div className='text-lg font-medium'>
                  {formatQuota(usage.platform_quota)}
                </div>
                <div className='text-muted-foreground text-xs'>
                  {formatNumber(usage.token_used)} {t('Tokens')}
                </div>
              </div>
              <div className='rounded-md border p-3'>
                <div className='text-muted-foreground text-xs'>
                  {t('Gross margin')}
                </div>
                <div className='text-lg font-medium'>{formatQuota(margin)}</div>
              </div>
            </div>
            {usage.users.length === 0 ? (
              <EmptyState
                title={t('No usage in this range')}
                description={t(
                  'No consume logs were found for users on your current channels.'
                )}
              />
            ) : (
              <StaticDataTable
                columns={columns}
                data={usage.users}
                getRowKey={(row) => String(row.user_id)}
              />
            )}
          </div>
        ) : null}
      </div>

      <div className='space-y-3'>
        <h2 className='text-sm font-medium'>{t('Settlement bills')}</h2>
        {(settlementQuery.data?.items ?? []).length === 0 ? (
          <EmptyState title={t('No settlement bills')} />
        ) : (
          (settlementQuery.data?.items ?? []).map((bill) => (
            <div key={String(bill.id)} className='rounded-md border p-3 text-sm'>
              #{String(bill.id)} · {String(bill.status)} ·{' '}
              {formatQuota(Number(bill.platform_quota) || 0)}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
