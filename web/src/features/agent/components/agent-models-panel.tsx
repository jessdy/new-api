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
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import {
  StaticDataTable,
  type StaticDataTableColumn,
} from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getLobeIcon } from '@/lib/lobe-icon'
import { handleServerError } from '@/lib/handle-server-error'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import {
  listAgentModels,
  upsertAgentModelCost,
  type AgentModelListItem,
} from '../api'

type AgentModelsPanelProps = {
  agentId?: number
}

export function AgentModelsPanel(props: AgentModelsPanelProps) {
  const { t } = useTranslation()
  const userRole = useAuthStore((state) => state.auth.user?.role ?? 0)
  const canEditCost = userRole >= ROLE.ADMIN
  const [filter, setFilter] = useState('')
  const [editing, setEditing] = useState<AgentModelListItem | null>(null)
  const [costRatio, setCostRatio] = useState('1')

  const modelsQuery = useQuery({
    queryKey: ['agent', 'models', props.agentId],
    queryFn: () => listAgentModels(props.agentId),
  })

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertAgentModelCost(
        {
          model: editing?.model_name ?? '',
          cost_ratio: Number(costRatio),
        },
        props.agentId
      ),
    onSuccess: () => {
      toast.success(t('Agent model cost saved'))
      setEditing(null)
      void modelsQuery.refetch()
    },
    onError: (error) => handleServerError(error),
  })

  const filtered = useMemo(() => {
    const items = modelsQuery.data ?? []
    const q = filter.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (item) =>
        item.model_name.toLowerCase().includes(q) ||
        item.channel_names.some((name) => name.toLowerCase().includes(q))
    )
  }, [filter, modelsQuery.data])

  const columns = useMemo<StaticDataTableColumn<AgentModelListItem>[]>(
    () => [
      {
        id: 'model',
        header: t('Model'),
        cell: (row) => (
          <div className='flex min-w-0 items-center gap-2.5'>
            <span className='flex size-6 shrink-0 items-center justify-center'>
              {getLobeIcon(row.model_name, 24)}
            </span>
            <span className='font-mono text-sm break-all'>{row.model_name}</span>
          </div>
        ),
      },
      {
        id: 'channels',
        header: t('Channels'),
        cell: (row) =>
          row.channel_names.length === 0 ? (
            <span className='text-muted-foreground text-sm'>—</span>
          ) : (
            <div className='flex flex-wrap gap-1'>
              {row.channel_names.map((name) => (
                <Badge key={`${row.model_name}-${name}`} variant='secondary'>
                  {name}
                </Badge>
              ))}
            </div>
          ),
      },
      {
        id: 'cost',
        header: t('Upstream cost ratio'),
        cell: (row) => (
          <div className='space-y-0.5'>
            <div className='font-mono text-sm'>×{row.cost_ratio}</div>
            <div className='text-muted-foreground text-xs'>
              {row.has_cost_override
                ? t('Custom agent cost')
                : t('Platform default (×1)')}
            </div>
          </div>
        ),
      },
      {
        id: 'actions',
        header: canEditCost ? t('Actions') : '',
        cell: (row) =>
          canEditCost ? (
            <Button
              size='sm'
              variant='outline'
              onClick={() => {
                setEditing(row)
                setCostRatio(String(row.cost_ratio || 1))
              }}
            >
              {t('Set cost')}
            </Button>
          ) : null,
      },
    ],
    [canEditCost, t]
  )

  if (modelsQuery.isLoading) {
    return <LoadingState message={t('Loading models…')} />
  }
  if (modelsQuery.isError) {
    return (
      <ErrorState
        title={t('Failed to load agent models')}
        onRetry={() => {
          void modelsQuery.refetch()
        }}
      />
    )
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h2 className='text-base font-semibold'>{t('Model management')}</h2>
          <p className='text-muted-foreground text-sm'>
            {canEditCost
              ? t(
                  'Set the upstream cost ratio charged to this agent for each model. Agents can view but cannot change it.'
                )
              : t(
                  'Models available through your selected channels. Upstream cost is set by the platform administrator.'
                )}
          </p>
        </div>
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={t('Search models or channels')}
          className='sm:max-w-xs'
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={t('No models')}
          description={t(
            'Select channels first to populate the agent model list.'
          )}
        />
      ) : (
        <StaticDataTable
          columns={columns}
          data={filtered}
          getRowKey={(row) => row.model_name}
        />
      )}

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        title={t('Set upstream cost')}
        description={
          editing
            ? t('Cost ratio for {{model}} relative to the platform base price.', {
                model: editing.model_name,
              })
            : undefined
        }
        footer={
          <>
            <Button variant='outline' onClick={() => setEditing(null)}>
              {t('Cancel')}
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !(Number(costRatio) > 0)}
            >
              {t('Save')}
            </Button>
          </>
        }
      >
        <div className='space-y-2'>
          <Label htmlFor='agent-model-cost-ratio'>
            {t('Upstream cost ratio')}
          </Label>
          <Input
            id='agent-model-cost-ratio'
            type='number'
            min={0}
            step='0.01'
            value={costRatio}
            onChange={(event) => setCostRatio(event.target.value)}
          />
          <p className='text-muted-foreground text-xs'>
            {t(
              'Example: 0.8 means the agent settles at 80% of the platform base quota for this model.'
            )}
          </p>
        </div>
      </Dialog>
    </div>
  )
}
