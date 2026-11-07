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
import {
  ChevronDown,
  Eye,
  FileText,
  Image as ImageIcon,
  Music2,
  Type,
  Video,
} from 'lucide-react'
import { memo, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import { useBillingTime } from '../hooks/use-billing-time'
import {
  getCardExamplePrice,
  getDynamicDisplayGroupRatio,
  getDynamicPriceUnitLabelKey,
  getDynamicPricingSummary,
  isUnconfiguredTaskUsageModel,
} from '../lib/dynamic-price'
import { isTokenBasedModel } from '../lib/model-helpers'
import { formatPrice, formatRequestPrice } from '../lib/price'
import { taskPriceLabel, taskUsageUnitLabel } from '../lib/task-price-display'
import type { Modality, PricingModel, TokenUnit } from '../types'
import { ModelAttributesHover } from './model-attributes-hover'
import { ModelBillingModeBadge } from './model-billing-mode-badge'
import type { ModelPerfBadgeData } from './model-perf-badge'

export interface ModelCardProps {
  model: PricingModel
  onClick: (modelName: string) => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  selectedGroup?: string
  /** Kept for callers; performance is shown on the vendor section header. */
  perf?: ModelPerfBadgeData
}

const MODALITY_ICONS: Record<
  Modality,
  { icon: typeof Type; className: string; labelKey: string }
> = {
  text: {
    icon: Type,
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
    labelKey: 'Text',
  },
  image: {
    icon: ImageIcon,
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    labelKey: 'Image',
  },
  file: {
    icon: FileText,
    className: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
    labelKey: 'File',
  },
  audio: {
    icon: Music2,
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
    labelKey: 'Audio',
  },
  video: {
    icon: Video,
    className: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
    labelKey: 'Video',
  },
}

export const ModelCard = memo(function ModelCard(props: ModelCardProps) {
  const { t, i18n } = useTranslation()
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const priceRate = props.priceRate ?? 1
  const usdExchangeRate = props.usdExchangeRate ?? 1
  const showRechargePrice = props.showRechargePrice ?? false
  const isTokenBased = isTokenBasedModel(props.model)
  const tokenUnitLabel = tokenUnit === 'K' ? '1K' : '1M'
  const isUnconfiguredTaskUsage = isUnconfiguredTaskUsageModel(props.model)
  const billingTime = useBillingTime(props.model.billing_expr)
  const currency = useSystemConfigStore((state) => state.config.currency)
  const modalities = useMemo(() => {
    const seen = new Set<Modality>()
    const list: Modality[] = []
    for (const modality of [
      ...(props.model.input_modalities ?? []),
      ...(props.model.output_modalities ?? []),
    ]) {
      if (seen.has(modality)) continue
      seen.add(modality)
      list.push(modality)
    }
    return list
  }, [props.model.input_modalities, props.model.output_modalities])
  const dynamicPriceOptions = useMemo(
    () => ({
      now: billingTime === undefined ? undefined : new Date(billingTime),
      tokenUnit,
      showRechargePrice,
      priceRate,
      usdExchangeRate,
      groupRatioMultiplier: getDynamicDisplayGroupRatio(
        props.model,
        props.selectedGroup
      ),
    }),
    [
      props.model,
      props.selectedGroup,
      billingTime,
      tokenUnit,
      showRechargePrice,
      priceRate,
      usdExchangeRate,
    ]
  )
  const dynamicSummary = useMemo(
    () => getDynamicPricingSummary(props.model, dynamicPriceOptions),
    // Currency is read indirectly by the price formatter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.model, dynamicPriceOptions, currency]
  )
  const cardExamplePrice = useMemo(
    () => getCardExamplePrice(props.model, dynamicPriceOptions),
    // Currency is read indirectly by the price formatter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.model, dynamicPriceOptions, currency]
  )

  let priceSummary: ReactNode
  if (dynamicSummary) {
    const cacheReadEntries = dynamicSummary.secondaryEntries.filter(
      (entry) => entry.field === 'cacheReadPrice' && entry.unit === 'token'
    )
    if (dynamicSummary.isSpecialExpression) {
      priceSummary = (
        <div className='min-w-0'>
          <span className='text-warning'>
            {t('Special billing expression')}
          </span>
          <code className='text-muted-foreground mt-1 line-clamp-2 block font-mono text-xs break-all'>
            {dynamicSummary.rawExpression}
          </code>
        </div>
      )
    } else if (
      dynamicSummary.primaryEntries.length > 0 ||
      cacheReadEntries.length > 0
    ) {
      priceSummary = (
        <>
          {[
            dynamicSummary.primaryEntries.slice(
              0,
              dynamicSummary.providerCount ? 2 : undefined
            ),
            cacheReadEntries,
          ]
            .flat()
            .map((entry) => {
              const unitLabelKey = getDynamicPriceUnitLabelKey(entry)
              const unitLabel = taskUsageUnitLabel(
                entry,
                i18n.language,
                unitLabelKey ? t(unitLabelKey) : tokenUnitLabel
              )
              let label: ReactNode = null
              if (entry.labelKind !== 'schema') {
                label = t(entry.shortLabel)
              } else {
                label = taskPriceLabel(
                  entry.description,
                  entry.shortLabel,
                  i18n.language
                )
              }
              return (
                <div
                  key={entry.key}
                  className={cn(
                    'flex min-w-0 items-baseline justify-between gap-3 text-sm',
                    dynamicSummary.isTaskUsage && 'flex-col items-stretch gap-1'
                  )}
                >
                  {label && (
                    <span className='text-muted-foreground shrink-0 text-xs break-words whitespace-normal'>
                      {label}
                    </span>
                  )}
                  <span className='min-w-0 text-right font-medium tabular-nums [overflow-wrap:anywhere]'>
                    <span>{entry.formattedRange ?? entry.formatted}</span>
                    <span className='text-muted-foreground text-xs font-normal whitespace-nowrap'>
                      {' '}
                      / {unitLabel}
                    </span>
                  </span>
                </div>
              )
            })}
          {dynamicSummary.isTimePricing && (
            <span className='text-muted-foreground text-xs'>
              {t('Current period price')}
            </span>
          )}
          {dynamicSummary.isMixedBilling && (
            <span className='text-muted-foreground text-xs'>
              {t('Token or per-call pricing')}
            </span>
          )}
          {cardExamplePrice && (
            <span className='text-muted-foreground text-xs break-words'>
              {cardExamplePrice.label} ≈ {cardExamplePrice.formatted}
            </span>
          )}
          {dynamicSummary.isTaskUsage &&
            dynamicSummary.tierCount > 1 &&
            dynamicSummary.tier?.label &&
            !dynamicSummary.primaryEntries.some(
              (entry) => entry.formattedRange
            ) && (
              <span className='text-muted-foreground text-xs break-words'>
                ({dynamicSummary.tier.label})
              </span>
            )}
        </>
      )
    } else {
      priceSummary = (
        <span className='text-muted-foreground'>
          {dynamicSummary.hasUnconfiguredProviders
            ? t('Usage-based billing · price not configured')
            : t('Dynamic Pricing')}
        </span>
      )
    }
  } else if (isUnconfiguredTaskUsage) {
    priceSummary = (
      <span className='text-muted-foreground'>
        {t('Usage-based billing · price not configured')}
      </span>
    )
  } else if (isTokenBased) {
    const inputPrice = formatPrice(
      props.model,
      'input',
      tokenUnit,
      showRechargePrice,
      priceRate,
      usdExchangeRate,
      props.selectedGroup
    )
    const outputPrice = formatPrice(
      props.model,
      'output',
      tokenUnit,
      showRechargePrice,
      priceRate,
      usdExchangeRate,
      props.selectedGroup
    )
    priceSummary = (
      <>
        <div className='flex min-w-0 items-baseline justify-between gap-3 text-sm'>
          <span className='text-muted-foreground shrink-0'>{tokenUnitLabel}</span>
          <span className='min-w-0 text-right font-medium tabular-nums [overflow-wrap:anywhere]'>
            <span className='text-muted-foreground font-normal'>
              {t('Input')}
            </span>{' '}
            {inputPrice}
            {' / '}
            <span className='text-muted-foreground font-normal'>
              {t('Output')}
            </span>{' '}
            {outputPrice}
          </span>
        </div>
        {props.model.cache_ratio != null && (
          <div className='flex min-w-0 items-baseline justify-between gap-3 text-sm'>
            <span className='text-muted-foreground shrink-0 text-xs'>
              {t('Cached')}
            </span>
            <span className='font-medium tabular-nums'>
              {formatPrice(
                props.model,
                'cache',
                tokenUnit,
                showRechargePrice,
                priceRate,
                usdExchangeRate,
                props.selectedGroup
              )}
              <span className='text-muted-foreground text-xs font-normal'>
                {' '}
                / {tokenUnitLabel}
              </span>
            </span>
          </div>
        )}
      </>
    )
  } else {
    priceSummary = (
      <div className='flex min-w-0 items-baseline justify-between gap-3 text-sm'>
        <span className='text-muted-foreground shrink-0 text-xs'>
          {t('request')}
        </span>
        <span className='font-medium tabular-nums'>
          {formatRequestPrice(
            props.model,
            showRechargePrice,
            priceRate,
            usdExchangeRate,
            props.selectedGroup
          )}
          <span className='text-muted-foreground text-xs font-normal'>
            {' '}
            / {t('request')}
          </span>
        </span>
      </div>
    )
  }

  return (
    <article className='group bg-muted/40 hover:border-foreground/20 dark:bg-background/60 flex h-full min-w-0 max-w-full flex-col gap-3 rounded-lg border p-4 transition-colors'>
      <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
        <div className='flex min-w-0 flex-1 basis-32 items-center gap-1'>
          <h3
            className='min-w-0 truncate text-base font-semibold'
            title={props.model.model_name}
          >
            {props.model.model_name}
          </h3>
          <ModelAttributesHover model={props.model} />
        </div>
        {modalities.length > 0 && (
          <span
            className='inline-flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1'
            data-testid='model-capability-tags'
          >
            {modalities.map((modality) => {
              const config = MODALITY_ICONS[modality]
              const Icon = config.icon
              const label = t(config.labelKey)
              return (
                <span
                  key={modality}
                  className={cn(
                    'inline-flex size-5 shrink-0 items-center justify-center rounded-md',
                    config.className
                  )}
                  title={label}
                  role='img'
                  aria-label={label}
                >
                  <Icon aria-hidden className='size-3' strokeWidth={2.5} />
                </span>
              )
            })}
          </span>
        )}
      </div>

      <div className='flex min-w-0 items-center gap-1.5'>
        <span className='bg-muted text-muted-foreground shrink-0 rounded-md border px-1 py-px font-mono text-xs select-none'>
          {t('ID')}
        </span>
        <code
          className='text-muted-foreground min-w-0 flex-1 break-all font-mono text-xs'
          title={props.model.model_name}
        >
          {props.model.model_name}
        </code>
        <CopyButton
          value={props.model.model_name}
          tooltip={t('Copy model name')}
          className='size-7 shrink-0'
          iconClassName='size-3.5'
        />
      </div>

      <div
        role='group'
        aria-label={t('Pricing')}
        className='mt-auto flex min-w-0 flex-col gap-1.5'
      >
        <ModelBillingModeBadge model={props.model} appearance='caption' />
        {dynamicSummary?.providerCount && (
          <span className='text-muted-foreground text-xs break-words'>
            {t('{{count}} providers', {
              count: dynamicSummary.providerCount,
            })}
            {dynamicSummary.hasUnconfiguredProviders &&
              ` · ${t('Not configured for some providers')}`}
          </span>
        )}
        <div className='flex min-w-0 flex-col gap-1.5'>{priceSummary}</div>
      </div>

      <div className='mt-auto flex items-center justify-between gap-2 border-t pt-2'>
        <Button
          variant='ghost'
          size='sm'
          className='text-primary h-auto gap-1.5 px-1.5 py-1 text-xs font-medium'
          onClick={() => props.onClick(props.model.model_name || '')}
        >
          <Eye aria-hidden className='size-3.5' />
          {t('View detailed pricing')}
          <ChevronDown aria-hidden className='size-3.5' />
        </Button>
      </div>
    </article>
  )
})
