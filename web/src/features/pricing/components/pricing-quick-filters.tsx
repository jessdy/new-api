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
import { memo, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { FILTER_ALL } from '../constants'
import { parseTags } from '../lib/filters'
import type { PricingModel, PricingVendor } from '../types'

type FilterOption = {
  value: string
  label: string
  count?: number
  icon?: ReactNode
}

export interface PricingQuickFiltersProps {
  vendorFilter: string
  tagFilter: string
  onVendorChange: (value: string) => void
  onTagChange: (value: string) => void
  vendors: PricingVendor[]
  tags: string[]
  models: PricingModel[]
  className?: string
}

function FilterChip(props: {
  option: FilterOption
  active: boolean
  onClick: () => void
}) {
  return (
    <Button
      type='button'
      variant={props.active ? 'default' : 'secondary'}
      size='sm'
      onClick={props.onClick}
      aria-pressed={props.active}
      className={cn(
        'h-8 max-w-full shrink-0 gap-1.5 rounded-full px-3 text-xs font-medium',
        !props.active && 'bg-muted/60 hover:bg-muted text-foreground'
      )}
      title={props.option.label}
    >
      {props.option.icon && (
        <span className='shrink-0 [&>svg]:size-3.5'>{props.option.icon}</span>
      )}
      <span className='truncate'>{props.option.label}</span>
      {props.option.count != null && (
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[11px] tabular-nums',
            props.active
              ? 'bg-background/20 text-primary-foreground'
              : 'bg-background/70 text-muted-foreground'
          )}
        >
          {props.option.count}
        </span>
      )}
    </Button>
  )
}

function FilterChipRow(props: {
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
}) {
  return (
    <div className='flex min-w-0 items-start gap-3'>
      <span className='text-muted-foreground mt-1.5 w-16 shrink-0 text-left text-xs font-medium sm:w-20'>
        {props.label}
      </span>
      <div
        role='group'
        aria-label={props.label}
        className='flex min-w-0 flex-1 flex-wrap gap-1.5'
      >
        {props.options.map((option) => (
          <FilterChip
            key={option.value}
            option={option}
            active={props.value === option.value}
            onClick={() => props.onChange(option.value)}
          />
        ))}
      </div>
    </div>
  )
}

export const PricingQuickFilters = memo(function PricingQuickFilters(
  props: PricingQuickFiltersProps
) {
  const { t } = useTranslation()
  const counts = useMemo(() => {
    const vendors = new Map<string, number>()
    const tags = new Map<string, number>()
    for (const model of props.models) {
      if (model.vendor_name) {
        vendors.set(
          model.vendor_name,
          (vendors.get(model.vendor_name) ?? 0) + 1
        )
      }
      for (const tag of new Set(
        parseTags(model.tags).map((item) => item.toLowerCase())
      )) {
        tags.set(tag, (tags.get(tag) ?? 0) + 1)
      }
    }
    return { vendors, tags }
  }, [props.models])

  const vendorOptions: FilterOption[] = [
    {
      value: FILTER_ALL,
      label: t('All'),
      count: props.models.length,
    },
    ...props.vendors
      .map((vendor) => ({
        value: vendor.name,
        label: vendor.name,
        count: counts.vendors.get(vendor.name) ?? 0,
        icon: vendor.icon ? getLobeIcon(vendor.icon, 14) : undefined,
      }))
      .filter((vendor) => (vendor.count ?? 0) > 0),
  ]

  const tagOptions: FilterOption[] = [
    {
      value: FILTER_ALL,
      label: t('All'),
      count: props.models.length,
    },
    ...props.tags
      .map((tag) => ({
        value: tag,
        label: tag,
        count: counts.tags.get(tag.toLowerCase()) ?? 0,
      }))
      .filter((tag) => (tag.count ?? 0) > 0),
  ]

  if (vendorOptions.length <= 1 && tagOptions.length <= 1) {
    return null
  }

  return (
    <div className={cn('mx-auto w-full space-y-3', props.className)}>
      {vendorOptions.length > 1 && (
        <FilterChipRow
          label={t('Vendors')}
          value={props.vendorFilter}
          options={vendorOptions}
          onChange={props.onVendorChange}
        />
      )}
      {tagOptions.length > 1 && (
        <FilterChipRow
          label={t('Tags')}
          value={props.tagFilter}
          options={tagOptions}
          onChange={props.onTagChange}
        />
      )}
    </div>
  )
})
