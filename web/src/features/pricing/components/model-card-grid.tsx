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
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { getPerfMetricsSummary } from '@/features/performance-metrics/api'
import {
  formatLatency,
  formatThroughput,
  getSuccessRateDotClass,
} from '@/features/performance-metrics/lib/format'
import { getLobeIcon } from '@/lib/lobe-icon'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { DEFAULT_PRICING_PAGE_SIZE, DEFAULT_TOKEN_UNIT } from '../constants'
import type { PricingModel, TokenUnit } from '../types'
import { ModelCard } from './model-card'
import type { ModelPerfBadgeData } from './model-perf-badge'

export interface ModelCardGridProps {
  models: PricingModel[]
  onModelClick: (modelName: string) => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  selectedGroup?: string
}

type VendorSection = {
  key: string
  name: string
  icon?: string
  description?: string
  sortOrder: number
  models: PricingModel[]
}

function compareVendorOrder(a: PricingModel, b: PricingModel): number {
  const vendorOrderDiff =
    (b.vendor_sort_order ?? 0) - (a.vendor_sort_order ?? 0)
  if (vendorOrderDiff !== 0) return vendorOrderDiff
  const nameA = a.vendor_name?.trim() || ''
  const nameB = b.vendor_name?.trim() || ''
  if (!nameA && nameB) return 1
  if (nameA && !nameB) return -1
  const vendorNameDiff = nameA.localeCompare(nameB)
  if (vendorNameDiff !== 0) return vendorNameDiff
  const modelOrderDiff = (b.sort_order ?? 0) - (a.sort_order ?? 0)
  if (modelOrderDiff !== 0) return modelOrderDiff
  return (a.model_name || '').localeCompare(b.model_name || '')
}

function groupModelsByVendor(models: PricingModel[]): VendorSection[] {
  const sections: VendorSection[] = []
  const indexByKey = new Map<string, number>()

  for (const model of models) {
    const name = model.vendor_name?.trim() || ''
    const key = name || '__ungrouped__'
    const existing = indexByKey.get(key)
    if (existing !== undefined) {
      sections[existing].models.push(model)
      continue
    }
    indexByKey.set(key, sections.length)
    sections.push({
      key,
      name,
      icon: model.vendor_icon || model.icon,
      description: model.vendor_description,
      sortOrder: model.vendor_sort_order ?? 0,
      models: [model],
    })
  }

  sections.sort((a, b) => {
    if (a.key === '__ungrouped__') return 1
    if (b.key === '__ungrouped__') return -1
    if (a.sortOrder !== b.sortOrder) return b.sortOrder - a.sortOrder
    return a.name.localeCompare(b.name)
  })

  return sections
}

function aggregateSectionPerf(
  models: PricingModel[],
  perfMap: Map<string, ModelPerfBadgeData>
): ModelPerfBadgeData | undefined {
  let latencySum = 0
  let latencyCount = 0
  let tpsSum = 0
  let tpsCount = 0
  let successSum = 0
  let successCount = 0
  let bestSeries: ModelPerfBadgeData['recent_success_series']
  let bestSeriesLength = -1

  for (const model of models) {
    const perf = perfMap.get(model.model_name || '')
    if (!perf) continue
    if (Number.isFinite(perf.avg_latency_ms) && perf.avg_latency_ms > 0) {
      latencySum += perf.avg_latency_ms
      latencyCount += 1
    }
    if (Number.isFinite(perf.avg_tps) && perf.avg_tps > 0) {
      tpsSum += perf.avg_tps
      tpsCount += 1
    }
    if (
      Number.isFinite(perf.success_rate) &&
      perf.success_rate >= 0 &&
      perf.success_rate <= 100
    ) {
      successSum += perf.success_rate
      successCount += 1
    }
    const seriesLength = perf.recent_success_series?.length ?? 0
    if (seriesLength > bestSeriesLength) {
      bestSeries = perf.recent_success_series
      bestSeriesLength = seriesLength
    }
  }

  if (
    latencyCount === 0 &&
    tpsCount === 0 &&
    successCount === 0 &&
    !bestSeries
  ) {
    return undefined
  }

  return {
    avg_latency_ms: latencyCount ? latencySum / latencyCount : Number.NaN,
    avg_tps: tpsCount ? tpsSum / tpsCount : Number.NaN,
    success_rate: successCount ? successSum / successCount : Number.NaN,
    recent_success_series: bestSeries,
  }
}

export const ModelCardGrid = memo(function ModelCardGrid(
  props: ModelCardGridProps
) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const pageSize = DEFAULT_PRICING_PAGE_SIZE
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const totalPages = Math.max(1, Math.ceil(props.models.length / pageSize))
  const currentPage = Math.min(page, totalPages)

  const orderedModels = useMemo(
    () => [...props.models].sort(compareVendorOrder),
    [props.models]
  )
  const pagedModels = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return orderedModels.slice(start, start + pageSize)
  }, [currentPage, orderedModels, pageSize])
  const vendorSections = useMemo(
    () => groupModelsByVendor(pagedModels),
    [pagedModels]
  )
  const recentModels = pagedModels.map((model) => model.model_name || '')
  const perfQuery = useQuery({
    queryKey: ['perf-metrics-summary', 24, recentModels],
    queryFn: async () =>
      requireServerSuccess(await getPerfMetricsSummary(24, recentModels)),
    enabled: recentModels.length > 0,
    staleTime: 60 * 1000,
    retry: false,
  })

  const perfMap = useMemo(() => {
    const map = new Map<string, ModelPerfBadgeData>()
    for (const model of perfQuery.data?.data?.models ?? []) {
      map.set(model.model_name, {
        ...model,
        window_start: perfQuery.data?.data.window_start,
        window_end: perfQuery.data?.data.window_end,
      })
    }
    for (const [name, series] of Object.entries(
      perfQuery.data?.data?.recent_success_series ?? {}
    )) {
      map.set(name, {
        avg_latency_ms: Number.NaN,
        avg_tps: Number.NaN,
        success_rate: Number.NaN,
        ...map.get(name),
        recent_success_series: series,
      })
    }
    return map
  }, [perfQuery.data])

  if (props.models.length === 0) {
    return null
  }

  return (
    <div className='flex flex-col gap-4 sm:gap-5'>
      {vendorSections.map((section) => {
        const sectionPerf = aggregateSectionPerf(section.models, perfMap)
        const sectionIcon = section.icon ? getLobeIcon(section.icon, 28) : null
        const sectionTitle = section.name || t('Other models')
        const successRate = sectionPerf?.success_rate
        const hasSuccessRate =
          successRate != null &&
          Number.isFinite(successRate) &&
          successRate >= 0 &&
          successRate <= 100
        const statusSamples = (sectionPerf?.recent_success_series ?? [])
          .filter(
            (point) =>
              Number.isFinite(point.ts) &&
              Number.isFinite(point.success_rate) &&
              point.success_rate >= 0 &&
              point.success_rate <= 100
          )
          .sort((a, b) => a.ts - b.ts)
          .slice(-24)

        return (
          <section
            key={section.key}
            className='bg-card text-card-foreground ring-foreground/10 overflow-hidden rounded-xl ring-1'
          >
            <header className='flex flex-col gap-4 px-4 py-4 md:px-5 xl:flex-row xl:items-center xl:justify-between'>
              <div className='min-w-0 flex-1 space-y-3'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span className='inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-500/25 ring-inset dark:text-emerald-50'>
                    {sectionIcon ? (
                      <span className='inline-flex size-3.5 items-center justify-center [&>svg]:size-3.5'>
                        {sectionIcon}
                      </span>
                    ) : null}
                    {sectionTitle}
                  </span>
                </div>
                <div className='flex items-start gap-3'>
                  <span className='bg-background flex size-12 shrink-0 items-center justify-center rounded-lg border shadow-xs'>
                    {sectionIcon || (
                      <span className='text-muted-foreground text-sm font-bold'>
                        {sectionTitle.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <div className='min-w-0 space-y-1'>
                    <h2 className='truncate text-lg font-semibold tracking-tight'>
                      {sectionTitle}
                    </h2>
                    <p className='text-muted-foreground line-clamp-2 text-sm'>
                      {section.description ||
                        t('{{count}} models in this provider', {
                          count: section.models.length,
                        })}
                    </p>
                  </div>
                </div>
              </div>
              <div className='flex shrink-0 flex-col items-end gap-1'>
                <div className='flex h-8 w-36 items-end gap-px'>
                  {statusSamples.length > 0 ? (
                    statusSamples.map((sample) => (
                      <span
                        key={sample.ts}
                        aria-hidden
                        className={cn(
                          'w-[3px] flex-1 rounded-xs',
                          getSuccessRateDotClass(sample.success_rate)
                        )}
                        style={{
                          height: `${Math.max(20, sample.success_rate)}%`,
                        }}
                      />
                    ))
                  ) : (
                    <span className='text-muted-foreground text-xs'>—</span>
                  )}
                </div>
                <div className='text-muted-foreground flex items-baseline gap-2 text-xs tabular-nums'>
                  <span className='text-foreground font-mono text-sm'>
                    {hasSuccessRate ? `${successRate.toFixed(2)}%` : '—'}
                  </span>
                  <span>
                    {formatLatency(sectionPerf?.avg_latency_ms ?? 0)} ·{' '}
                    {formatThroughput(sectionPerf?.avg_tps ?? 0)}
                  </span>
                </div>
              </div>
            </header>

            <div className='grid min-w-0 grid-cols-1 items-start gap-4 p-4 md:grid-cols-2 md:p-5 lg:grid-cols-3 xl:grid-cols-3'>
              {section.models.map((model) => (
                <ModelCard
                  key={model.id ?? model.model_name}
                  model={model}
                  tokenUnit={tokenUnit}
                  priceRate={props.priceRate}
                  usdExchangeRate={props.usdExchangeRate}
                  showRechargePrice={props.showRechargePrice}
                  selectedGroup={props.selectedGroup}
                  perf={perfMap.get(model.model_name || '')}
                  onClick={props.onModelClick}
                />
              ))}
            </div>
          </section>
        )
      })}

      {totalPages > 1 && (
        <div className='text-muted-foreground flex flex-col items-center justify-between gap-3 border-t px-4 py-3 text-sm sm:flex-row'>
          <p className='text-muted-foreground'>
            {t('Page {{current}} of {{total}}', {
              current: currentPage,
              total: totalPages,
            })}
          </p>
          <div className='flex items-center gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage <= 1}
              className='gap-1.5'
            >
              <ChevronLeft className='size-4' />
              {t('Previous page')}
            </Button>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={currentPage >= totalPages}
              className='gap-1.5'
            >
              {t('Next page')}
              <ChevronRight className='size-4' />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
})
