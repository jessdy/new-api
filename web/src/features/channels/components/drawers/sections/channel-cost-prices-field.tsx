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
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  parseChannelCostPricing,
  pruneChannelCostPricing,
  stringifyChannelCostPricing,
} from '@/features/channels/lib/channel-cost-pricing'
import {
  modelPricingDisplay,
  pricingFromDraft,
  pricingRow,
} from '@/features/model-pricing/pricing'
import { ModelPriceCell } from '@/features/pricing/components/model-price-cell'
import {
  ModelPricingEditorPanel,
  type ModelPricingEditorPanelHandle,
} from '@/features/system-settings/models/model-pricing-sheet'
import { getLobeIcon } from '@/lib/lobe-icon'

type ChannelCostPricesFieldProps = {
  models: string[]
  value?: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function ChannelCostPricesField(props: ChannelCostPricesFieldProps) {
  const { t } = useTranslation()
  const editorRef = useRef<ModelPricingEditorPanelHandle>(null)
  const [detailModel, setDetailModel] = useState<string | null>(null)
  const pricing = useMemo(
    () =>
      pruneChannelCostPricing(
        parseChannelCostPricing(props.value),
        props.models
      ),
    [props.models, props.value]
  )
  const editData = useMemo(() => {
    if (!detailModel) return null
    return pricingRow(detailModel, pricing[detailModel] ?? {})
  }, [detailModel, pricing])

  const saveDetail = async () => {
    if (!detailModel) return
    const draft = await editorRef.current?.commitDraft()
    if (!draft) return
    const next = {
      ...pricing,
      [detailModel]: pricingFromDraft(draft),
    }
    props.onChange(stringifyChannelCostPricing(next))
    setDetailModel(null)
  }

  return (
    <div className='space-y-3'>
      <div className='space-y-1'>
        <div className='text-sm font-medium'>{t('Cost prices')}</div>
        <p className='text-muted-foreground text-xs'>
          {t(
            'Set the upstream cost for each model on this channel. Admin settlement reports use these prices.'
          )}
        </p>
      </div>
      {props.models.length === 0 ? (
        <EmptyState
          title={t('No models selected')}
          description={t('Select models first to set per-model cost prices.')}
        />
      ) : (
        <div className='space-y-2'>
          {props.models.map((modelName) => {
            const values = pricing[modelName] ?? {}
            const hasCost = Object.keys(values).length > 0
            return (
              <div
                key={modelName}
                className='flex items-center justify-between gap-3 rounded-md border px-3 py-2'
              >
                <div className='flex min-w-0 items-center gap-2'>
                  <span className='flex size-6 shrink-0 items-center justify-center'>
                    {getLobeIcon(modelName, 24)}
                  </span>
                  <span className='font-mono text-sm break-all'>
                    {modelName}
                  </span>
                </div>
                <Button
                  type='button'
                  variant='ghost'
                  className='h-auto max-w-[16rem] justify-end px-0 py-1 text-right font-normal hover:bg-transparent'
                  disabled={props.disabled}
                  aria-label={t('Set cost price for {{model}}', {
                    model: modelName,
                  })}
                  onClick={() => setDetailModel(modelName)}
                >
                  {hasCost ? (
                    <ModelPriceCell
                      model={modelPricingDisplay({
                        model_name: modelName,
                        effective: values,
                      })}
                      options={{ tokenUnit: 'M' }}
                      showExpression={false}
                    />
                  ) : (
                    <span className='text-muted-foreground text-sm'>
                      {t('Set cost')}
                    </span>
                  )}
                </Button>
              </div>
            )
          })}
        </div>
      )}

      <Sheet
        open={Boolean(detailModel)}
        onOpenChange={(open) => {
          if (!open) setDetailModel(null)
        }}
      >
        <SheetContent className='flex w-full flex-col gap-0 sm:max-w-xl'>
          <SheetHeader>
            <SheetTitle>{t('Cost price')}</SheetTitle>
            <SheetDescription>
              {detailModel
                ? t('Set the upstream cost for {{model}}', {
                    model: detailModel,
                  })
                : null}
            </SheetDescription>
          </SheetHeader>
          <div className='min-h-0 flex-1 overflow-hidden p-4'>
            {editData ? (
              <ModelPricingEditorPanel
                ref={editorRef}
                editData={editData}
                embedded
                className='h-full'
              />
            ) : null}
          </div>
          <div className='flex justify-end gap-2 border-t p-4'>
            <Button variant='outline' onClick={() => setDetailModel(null)}>
              {t('Close')}
            </Button>
            <Button
              type='button'
              onClick={() => {
                void saveDetail()
              }}
              disabled={props.disabled}
            >
              {t('Save')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
