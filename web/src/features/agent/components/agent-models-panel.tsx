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
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  StaticDataTable,
  type StaticDataTableColumn,
} from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  modelPricingDisplay,
  pricingFromDraft,
  pricingRow,
} from '@/features/model-pricing/pricing'
import { DynamicPricingBreakdown } from '@/features/pricing/components/dynamic-pricing-breakdown'
import { ModelPriceCell } from '@/features/pricing/components/model-price-cell'
import { isDynamicPricingModel } from '@/features/pricing/lib/dynamic-price'
import {
  ModelPricingEditorPanel,
  type ModelPricingEditorPanelHandle,
} from '@/features/system-settings/models/model-pricing-sheet'
import { handleServerError } from '@/lib/handle-server-error'
import { getLobeIcon } from '@/lib/lobe-icon'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

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
  useSystemConfigStore((state) => state.config.currency)
  const userRole = useAuthStore((state) => state.auth.user?.role ?? 0)
  const canEditCost = userRole >= ROLE.ADMIN
  const [filter, setFilter] = useState('')
  const [detailModel, setDetailModel] = useState<AgentModelListItem | null>(
    null
  )
  const editorRef = useRef<ModelPricingEditorPanelHandle>(null)

  const modelsQuery = useQuery({
    queryKey: ['agent', 'models', props.agentId],
    queryFn: () => listAgentModels(props.agentId),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const draft = await editorRef.current?.commitDraft()
      if (!draft || !detailModel) throw new Error(t('Save failed'))
      return upsertAgentModelCost(
        { model: detailModel.model_name, pricing: pricingFromDraft(draft) },
        props.agentId
      )
    },
    onSuccess: async () => {
      toast.success(t('Agent model cost saved'))
      await modelsQuery.refetch()
      setDetailModel(null)
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

  const detailPricing = useMemo(() => {
    if (!detailModel) return null
    return modelPricingDisplay({
      model_name: detailModel.model_name,
      effective: detailModel.cost_effective ?? {},
    })
  }, [detailModel])

  const editData = useMemo(() => {
    if (!detailModel) return null
    return pricingRow(detailModel.model_name, detailModel.cost_effective ?? {})
  }, [detailModel])

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
            <span className='font-mono text-sm break-all'>
              {row.model_name}
            </span>
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
        header: t('Upstream cost'),
        cell: (row) => (
          <Button
            variant='ghost'
            className='h-auto w-full max-w-full min-w-0 justify-start px-0 py-1 text-left font-normal hover:bg-transparent'
            aria-label={t('View pricing for {{model}}', {
              model: row.model_name,
            })}
            onClick={() => setDetailModel(row)}
          >
            <ModelPriceCell
              model={modelPricingDisplay({
                model_name: row.model_name,
                effective: row.cost_effective ?? {},
              })}
              options={{ tokenUnit: 'M' }}
              showExpression={false}
            />
          </Button>
        ),
      },
    ],
    [t]
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
                  'Set the upstream cost charged to this agent for each model. Agents can view but cannot change it.'
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

      <Sheet
        open={Boolean(detailModel)}
        onOpenChange={(open) => {
          if (!open) setDetailModel(null)
        }}
      >
        <SheetContent className='flex w-full flex-col gap-0 sm:max-w-xl'>
          <SheetHeader>
            <SheetTitle>{t('Upstream cost')}</SheetTitle>
            <SheetDescription>
              {detailModel
                ? t('Detailed upstream cost for {{model}}', {
                    model: detailModel.model_name,
                  })
                : null}
            </SheetDescription>
          </SheetHeader>
          <div className='min-h-0 flex-1 overflow-hidden p-4'>
            {canEditCost && editData ? (
              <ModelPricingEditorPanel
                ref={editorRef}
                editData={editData}
                embedded
                className='h-full'
              />
            ) : null}
            {!canEditCost && detailPricing ? (
              <div className='h-full overflow-y-auto'>
                <section className='space-y-3'>
                  <h3 className='text-muted-foreground text-xs'>
                    {t('Current Billing')}
                  </h3>
                  <div className='max-w-xs'>
                    <ModelPriceCell
                      model={detailPricing}
                      options={{ tokenUnit: 'M' }}
                      showExpression
                    />
                  </div>
                  {isDynamicPricingModel(detailPricing) ? (
                    <DynamicPricingBreakdown
                      compact
                      billingExpr={detailPricing.billing_expr}
                    />
                  ) : (
                    detailPricing.quota_type === 0 &&
                    Number.isFinite(detailPricing.model_ratio) && (
                      <dl className='grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3'>
                        {(
                          [
                            {
                              field: 'cache_ratio',
                              label: t('Cache Read'),
                            },
                            {
                              field: 'create_cache_ratio',
                              label: t('Cache write'),
                            },
                            {
                              field: 'image_ratio',
                              label: t('Image'),
                            },
                            {
                              field: 'audio_ratio',
                              label: t('Audio input'),
                            },
                            {
                              field: 'audio_completion_ratio',
                              label: t('Audio output'),
                            },
                            {
                              field: 'completion_ratio',
                              label: t('Completion'),
                            },
                          ] as const
                        )
                          .filter((item) => {
                            const value = detailPricing[item.field]
                            return (
                              typeof value === 'number' &&
                              Number.isFinite(value)
                            )
                          })
                          .map((item) => (
                            <div key={item.field}>
                              <dt className='text-muted-foreground'>
                                {item.label}
                              </dt>
                              <dd className='font-mono'>
                                {detailPricing[item.field]}
                              </dd>
                            </div>
                          ))}
                      </dl>
                    )
                  )}
                </section>
              </div>
            ) : null}
          </div>
          <div className='flex justify-end gap-2 border-t p-4'>
            <Button variant='outline' onClick={() => setDetailModel(null)}>
              {t('Close')}
            </Button>
            {canEditCost ? (
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                {t('Save')}
              </Button>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
