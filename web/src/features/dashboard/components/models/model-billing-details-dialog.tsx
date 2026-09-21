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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  StaticDataTable,
  staticDataTableClassNames,
  type StaticDataTableColumn,
} from '@/components/data-table'
import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import {
  getAgentLogStats,
  getAgentModelBillingLogs,
  getAllLogs,
  getLogStats,
  getUserLogStats,
  getUserLogs,
} from '@/features/usage-logs/api'
import { DetailsDialog } from '@/features/usage-logs/components/dialogs/details-dialog'
import {
  usageLogSchema,
  type UsageLog,
} from '@/features/usage-logs/data/schema'
import { parseLogOther } from '@/features/usage-logs/lib/format'
import type { GetLogsResponse } from '@/features/usage-logs/types'
import {
  formatLogQuota,
  formatNumber,
  formatQuota,
  formatTimestamp,
} from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'

const PAGE_SIZE = 20

interface ModelBillingDetailsDialogProps {
  modelName: string
  promptTokens: number
  completionTokens: number
  cacheTokens: number
  quota: number
  startTimestamp: number
  endTimestamp: number
  scope: 'admin' | 'agent' | 'self'
  isRoot: boolean
  username?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ModelBillingDetailsDialog(
  props: ModelBillingDetailsDialogProps
) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [selectedLog, setSelectedLog] = useState<UsageLog | null>(null)
  const query = useQuery({
    queryKey: [
      'model-billing-details',
      props.scope,
      props.modelName,
      props.startTimestamp,
      props.endTimestamp,
      props.username,
      page,
    ],
    enabled: props.open,
    queryFn: async () => {
      const params = {
        p: page,
        page_size: PAGE_SIZE,
        type: 2,
        model_name: props.modelName,
        start_timestamp: props.startTimestamp,
        end_timestamp: props.endTimestamp,
        ...(props.username && { username: props.username }),
      }
      let response: GetLogsResponse
      if (props.scope === 'admin') {
        response = await getAllLogs(params)
      } else if (props.scope === 'agent') {
        response = await getAgentModelBillingLogs(params)
      } else {
        response = await getUserLogs(params)
      }
      const data = requireServerSuccess(response).data
      return {
        logs: (data?.items ?? []).flatMap((item) => {
          const parsed = usageLogSchema.safeParse(item)
          return parsed.success ? [parsed.data] : []
        }),
        total: data?.total ?? 0,
      }
    },
  })
  const usageQuery = useQuery({
    queryKey: [
      'model-billing-usage',
      props.scope,
      props.modelName,
      props.startTimestamp,
      props.endTimestamp,
      props.username,
    ],
    enabled: props.open,
    queryFn: async () => {
      const params = {
        type: 2,
        model_name: props.modelName,
        start_timestamp: props.startTimestamp,
        end_timestamp: props.endTimestamp,
        ...(props.username && { username: props.username }),
      }
      let response
      if (props.scope === 'admin') {
        response = await getLogStats(params)
      } else if (props.scope === 'agent') {
        response = await getAgentLogStats(params)
      } else {
        response = await getUserLogStats(params)
      }
      return requireServerSuccess(response).data
    },
  })
  const promptTokens = usageQuery.data?.prompt_tokens ?? props.promptTokens
  const completionTokens =
    usageQuery.data?.completion_tokens ?? props.completionTokens
  const cacheTokens = usageQuery.data?.cache_tokens ?? props.cacheTokens
  const quota = Number(usageQuery.data?.quota ?? props.quota)
  const total = query.data?.total ?? 0
  let emptyContentKey = 'No data'
  if (query.isPending) {
    emptyContentKey = 'Loading'
  } else if (query.isError) {
    emptyContentKey = 'Loading failed'
  }
  const columns: StaticDataTableColumn<UsageLog>[] = [
    {
      id: 'time',
      header: t('Time'),
      cell: (log) => formatTimestamp(log.created_at),
    },
    ...(props.scope === 'self'
      ? []
      : [
          {
            id: 'user',
            header: t('User'),
            cell: (log: UsageLog) => log.username || `#${log.user_id}`,
          },
        ]),
    {
      id: 'input',
      header: t('Input Tokens'),
      className: staticDataTableClassNames.compactHeaderCellRight,
      cellClassName: staticDataTableClassNames.compactNumericCell,
      cell: (log) => formatNumber(log.prompt_tokens),
    },
    {
      id: 'output',
      header: t('Output Tokens'),
      className: staticDataTableClassNames.compactHeaderCellRight,
      cellClassName: staticDataTableClassNames.compactNumericCell,
      cell: (log) => formatNumber(log.completion_tokens),
    },
    {
      id: 'cache',
      header: t('Cache Tokens'),
      className: staticDataTableClassNames.compactHeaderCellRight,
      cellClassName: staticDataTableClassNames.compactNumericCell,
      cell: (log) => formatNumber(parseLogOther(log.other)?.cache_tokens || 0),
    },
    {
      id: 'billing',
      header: t('Billing'),
      className: staticDataTableClassNames.compactHeaderCellRight,
      cellClassName: staticDataTableClassNames.compactNumericCell,
      cell: (log) => (
        <Button
          variant='link'
          size='sm'
          className='h-auto p-0 font-semibold tabular-nums'
          onClick={() => setSelectedLog(log)}
        >
          {formatLogQuota(log.quota)}
        </Button>
      ),
    },
  ]

  return (
    <>
      <Dialog
        open={props.open}
        onOpenChange={props.onOpenChange}
        title={`${t('Billing Details')} · ${props.modelName}`}
        description={t('View the complete details for this log entry')}
        contentClassName='sm:max-w-5xl'
        contentHeight='min(72dvh, 720px)'
      >
        <div className='text-muted-foreground mb-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4'>
          <div>
            {t('Input Tokens')}: {formatNumber(promptTokens)}
          </div>
          <div>
            {t('Output Tokens')}: {formatNumber(completionTokens)}
          </div>
          <div>
            {t('Cache Tokens')}: {formatNumber(cacheTokens)}
          </div>
          <div>
            {t('Billing')}: {formatQuota(quota)}
          </div>
        </div>
        <StaticDataTable
          className={staticDataTableClassNames.embeddedContainer}
          columns={columns}
          data={query.data?.logs ?? []}
          getRowKey={(log) => `${log.created_at}-${log.id}`}
          empty={!query.data?.logs.length}
          emptyContent={t(emptyContentKey)}
          headerRowClassName={staticDataTableClassNames.mutedHeaderRow}
        />
        {total > PAGE_SIZE ? (
          <div className='flex items-center justify-end gap-2 pt-3'>
            <Button
              variant='outline'
              size='sm'
              disabled={page === 1 || query.isFetching}
              onClick={() => setPage((current) => current - 1)}
            >
              {t('Previous')}
            </Button>
            <span className='text-muted-foreground text-sm tabular-nums'>
              {page} / {Math.ceil(total / PAGE_SIZE)}
            </span>
            <Button
              variant='outline'
              size='sm'
              disabled={
                page >= Math.ceil(total / PAGE_SIZE) || query.isFetching
              }
              onClick={() => setPage((current) => current + 1)}
            >
              {t('Next')}
            </Button>
          </div>
        ) : null}
      </Dialog>
      {selectedLog ? (
        <DetailsDialog
          log={selectedLog}
          isAdmin={props.scope === 'admin'}
          isRoot={props.isRoot}
          open
          onOpenChange={(open) => {
            if (!open) setSelectedLog(null)
          }}
        />
      ) : null}
    </>
  )
}
