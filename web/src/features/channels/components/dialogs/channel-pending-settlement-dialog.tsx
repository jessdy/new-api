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
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  StaticDataTable,
  type StaticDataTableColumn,
} from '@/components/data-table'
import { Dialog } from '@/components/dialog'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { SettlementModelStatsTable } from '@/features/agent/components/settlement-model-stats-table'
import { CompactDateTimeRangePicker } from '@/features/usage-logs/components/compact-date-time-range-picker'
import { formatNumber, formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

import {
  getChannelPendingSettlement,
  type ChannelPendingSettlementChannel,
} from '../../api'

function defaultRange() {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 6)
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

export function ChannelPendingSettlementDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const [range, setRange] = useState(defaultRange)
  const [expandedChannelId, setExpandedChannelId] = useState<number | null>(
    null
  )
  const startTimestamp = range.start
    ? Math.floor(range.start.getTime() / 1000)
    : 0
  const endTimestamp = range.end ? Math.floor(range.end.getTime() / 1000) : 0

  const query = useQuery({
    queryKey: ['channel', 'pending-settlement', startTimestamp, endTimestamp],
    queryFn: () => getChannelPendingSettlement(startTimestamp, endTimestamp),
    enabled: props.open && startTimestamp > 0 && endTimestamp >= startTimestamp,
  })

  const columns = useMemo<
    StaticDataTableColumn<ChannelPendingSettlementChannel>[]
  >(
    () => [
      {
        id: 'channel',
        header: t('Channel'),
        cell: (row) => (
          <span className='inline-flex items-center gap-2 font-medium'>
            {expandedChannelId === row.channel_id ? (
              <ChevronDown className='text-muted-foreground size-4 shrink-0' />
            ) : (
              <ChevronRight className='text-muted-foreground size-4 shrink-0' />
            )}
            {row.channel_name || `#${row.channel_id}`}
          </span>
        ),
      },
      {
        id: 'input',
        header: t('Input Tokens'),
        cell: (row) => formatNumber(row.prompt_tokens),
      },
      {
        id: 'output',
        header: t('Output Tokens'),
        cell: (row) => formatNumber(row.completion_tokens),
      },
      {
        id: 'cache',
        header: t('Cache Tokens'),
        cell: (row) => formatNumber(row.cache_tokens),
      },
      {
        id: 'pending',
        header: t('Pending settlement amount'),
        cell: (row) => formatQuota(row.platform_quota),
      },
    ],
    [expandedChannelId, t]
  )

  const usage = query.data

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Pending settlement')}
      description={t(
        'Per-channel and per-model pending settlement in the selected time range.'
      )}
      contentClassName='sm:max-w-5xl'
      footer={
        <Button variant='outline' onClick={() => props.onOpenChange(false)}>
          {t('Close')}
        </Button>
      }
    >
      <div className='space-y-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
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
          <Button
            size='sm'
            onClick={() => {
              void query.refetch()
            }}
            disabled={query.isFetching}
          >
            {t('Query statement')}
          </Button>
        </div>

        {query.isLoading ? <LoadingState /> : null}
        {query.isError ? (
          <ErrorState
            title={t('Failed to load pending settlement')}
            onRetry={() => {
              void query.refetch()
            }}
          />
        ) : null}
        {usage ? (
          <div className='space-y-4'>
            <div className='grid gap-3 sm:grid-cols-3'>
              <div className='rounded-md border p-3'>
                <div className='text-muted-foreground text-xs'>
                  {t('Pending settlement amount')}
                </div>
                <div className='text-lg font-medium'>
                  {formatQuota(usage.platform_quota)}
                </div>
              </div>
              <div className='rounded-md border p-3'>
                <div className='text-muted-foreground text-xs'>
                  {t('Input Tokens')}
                </div>
                <div className='text-lg font-medium'>
                  {formatNumber(usage.prompt_tokens)}
                </div>
              </div>
              <div className='rounded-md border p-3'>
                <div className='text-muted-foreground text-xs'>
                  {t('Output Tokens')}
                </div>
                <div className='text-lg font-medium'>
                  {formatNumber(usage.completion_tokens)}
                </div>
              </div>
            </div>
            <div className='space-y-2'>
              <h3 className='text-sm font-medium'>
                {t('Per-model statistics')}
              </h3>
              <div className='overflow-hidden rounded-md border'>
                <SettlementModelStatsTable
                  models={usage.models ?? []}
                  amountMode='pending'
                />
              </div>
            </div>
            {usage.channels.length === 0 ? (
              <EmptyState title={t('No pending settlement in this range')} />
            ) : (
              <StaticDataTable
                columns={columns}
                data={usage.channels}
                getRowKey={(row) => String(row.channel_id)}
                renderRow={(row) => {
                  const expanded = expandedChannelId === row.channel_id
                  return (
                    <>
                      <TableRow
                        className='cursor-pointer'
                        onClick={() =>
                          setExpandedChannelId(expanded ? null : row.channel_id)
                        }
                      >
                        {columns.map((column) => (
                          <TableCell
                            key={column.id}
                            className={cn(
                              'max-w-full min-w-0 overflow-hidden',
                              typeof column.cellClassName === 'function'
                                ? column.cellClassName(row, 0)
                                : column.cellClassName
                            )}
                          >
                            {column.cell?.(row, 0)}
                          </TableCell>
                        ))}
                      </TableRow>
                      {expanded ? (
                        <TableRow>
                          <TableCell
                            colSpan={columns.length}
                            className='bg-muted/30 p-3'
                            onClick={(event) => event.stopPropagation()}
                          >
                            <SettlementModelStatsTable
                              models={row.models ?? []}
                              amountMode='pending'
                            />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </>
                  )
                }}
              />
            )}
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}
