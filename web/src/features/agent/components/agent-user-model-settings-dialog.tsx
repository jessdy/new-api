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
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import {
  StaticDataTable,
  type StaticDataTableColumn,
} from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import {
  type ModelPricingEntry,
} from '@/features/model-pricing/api'
import {
  modelPricingDisplay,
  pricingFromDraft,
  pricingRow,
  type PricingValues,
} from '@/features/model-pricing/pricing'
import { ModelPriceCell } from '@/features/pricing/components/model-price-cell'
import {
  ModelPricingEditorPanel,
  type ModelPricingEditorPanelHandle,
} from '@/features/system-settings/models/model-pricing-sheet'
import { handleServerError } from '@/lib/handle-server-error'
import { getLobeIcon } from '@/lib/lobe-icon'

import {
  getAgentUserModelSettings,
  replaceAgentUserModelSettings,
  type AgentUser,
  type AgentUserModelSettingItem,
} from '../api'

type AgentUserModelSettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: AgentUser
  agentId?: number
}

type DraftModel = {
  model_name: string
  enabled: boolean
  pricing: PricingValues
  effective: PricingValues
  version: string
}

function toDraft(item: AgentUserModelSettingItem): DraftModel {
  return {
    model_name: item.model_name,
    enabled: item.enabled,
    pricing: { ...(item.pricing ?? {}) },
    effective: { ...(item.effective ?? item.pricing ?? {}) },
    version: item.version,
  }
}

export function AgentUserModelSettingsDialog(
  props: AgentUserModelSettingsDialogProps
) {
  const { t } = useTranslation()
  const [limitEnabled, setLimitEnabled] = useState(false)
  const [drafts, setDrafts] = useState<DraftModel[]>([])
  const [editing, setEditing] = useState<DraftModel | null>(null)
  const editorRef = useRef<ModelPricingEditorPanelHandle>(null)

  const settingsQuery = useQuery({
    queryKey: ['agent', 'user-models', props.agentId, props.user.id],
    queryFn: () => getAgentUserModelSettings(props.user.id, props.agentId),
    enabled: props.open,
  })

  useEffect(() => {
    if (!settingsQuery.data) return
    setLimitEnabled(settingsQuery.data.limit_enabled)
    setDrafts(settingsQuery.data.models.map(toDraft))
  }, [settingsQuery.data])

  const saveMutation = useMutation({
    mutationFn: () =>
      replaceAgentUserModelSettings(
        props.user.id,
        {
          limit_enabled: limitEnabled,
          models: drafts.map((item) => ({
            model_name: item.model_name,
            enabled: item.enabled,
            pricing: item.pricing,
          })),
        },
        props.agentId
      ),
    onSuccess: () => {
      toast.success(t('User model settings saved'))
      props.onOpenChange(false)
    },
    onError: (error) => handleServerError(error),
  })

  const editEntry = useMemo<ModelPricingEntry | null>(() => {
    if (!editing) return null
    return {
      model_name: editing.model_name,
      version: editing.version,
      configured: editing.pricing,
      effective: {
        ...editing.effective,
        ...editing.pricing,
      },
    }
  }, [editing])

  const editData = useMemo(() => {
    if (!editEntry) return null
    const values = { ...editEntry.configured }
    if (editEntry.effective['billing_setting.billing_mode'] === 'tiered_expr') {
      values['billing_setting.billing_mode'] = 'tiered_expr'
      values['billing_setting.billing_expr'] =
        editEntry.effective['billing_setting.billing_expr']
    }
    return pricingRow(editEntry.model_name, {
      ...editEntry.effective,
      ...values,
    })
  }, [editEntry])

  const columns = useMemo<StaticDataTableColumn<DraftModel>[]>(
    () => [
      {
        id: 'enabled',
        header: t('Enabled'),
        cell: (row) => (
          <Checkbox
            checked={limitEnabled ? row.enabled : true}
            disabled={!limitEnabled}
            onCheckedChange={(value) => {
              setDrafts((prev) =>
                prev.map((item) =>
                  item.model_name === row.model_name
                    ? { ...item, enabled: Boolean(value) }
                    : item
                )
              )
            }}
            aria-label={t('Enable {{model}}', { model: row.model_name })}
          />
        ),
      },
      {
        id: 'model',
        header: t('Model'),
        cell: (row) => (
          <div className='flex min-w-0 items-center gap-2'>
            <span className='flex size-5 shrink-0 items-center justify-center'>
              {getLobeIcon(row.model_name, 20)}
            </span>
            <span className='font-mono text-sm break-all'>{row.model_name}</span>
          </div>
        ),
      },
      {
        id: 'price',
        header: t('Settlement price'),
        cell: (row) => (
          <ModelPriceCell
            model={modelPricingDisplay({
              model_name: row.model_name,
              effective: {
                ...row.effective,
                ...row.pricing,
              },
            })}
            options={{ tokenUnit: 'M' }}
            showExpression={false}
          />
        ),
      },
      {
        id: 'actions',
        header: t('Actions'),
        cell: (row) => (
          <Button
            size='sm'
            variant='outline'
            disabled={limitEnabled && !row.enabled}
            onClick={() => setEditing(row)}
          >
            {t('Set price')}
          </Button>
        ),
      },
    ],
    [limitEnabled, t]
  )

  return (
    <>
      <Dialog
        open={props.open}
        onOpenChange={props.onOpenChange}
        title={t('Model Settings')}
        description={t(
          'Choose visible models and settlement prices for {{user}}. Same pricing editor as admin Models.',
          { user: props.user.username }
        )}
        contentClassName='sm:max-w-4xl'
        footer={
          <>
            <Button
              variant='outline'
              onClick={() => props.onOpenChange(false)}
            >
              {t('Cancel')}
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || settingsQuery.isLoading}
            >
              {t('Save')}
            </Button>
          </>
        }
      >
        {settingsQuery.isLoading ? (
          <LoadingState message={t('Loading models…')} />
        ) : null}
        {settingsQuery.isError ? (
          <ErrorState
            title={t('Failed to load user model settings')}
            onRetry={() => {
              void settingsQuery.refetch()
            }}
          />
        ) : null}
        {!settingsQuery.isLoading && !settingsQuery.isError ? (
          <div className='space-y-4'>
            <div className='flex items-center justify-between gap-3 rounded-md border p-3'>
              <div className='space-y-1'>
                <Label htmlFor='limit-user-models'>
                  {t('Limit models for this user')}
                </Label>
                <p className='text-muted-foreground text-xs'>
                  {t(
                    'When enabled, only checked models are visible and billable for this user.'
                  )}
                </p>
              </div>
              <Switch
                id='limit-user-models'
                checked={limitEnabled}
                onCheckedChange={setLimitEnabled}
              />
            </div>
            {drafts.length === 0 ? (
              <EmptyState
                title={t('No models')}
                description={t(
                  'Select channels first to populate the agent model list.'
                )}
              />
            ) : (
              <StaticDataTable
                columns={columns}
                data={drafts}
                getRowKey={(row) => row.model_name}
              />
            )}
          </div>
        ) : null}
      </Dialog>

      <Sheet
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <SheetContent className='flex w-full flex-col gap-0 sm:max-w-3xl'>
          <SheetHeader>
            <SheetTitle>{t('Set price')}</SheetTitle>
            <SheetDescription>
              {editing
                ? t('Settlement price for {{model}}', {
                    model: editing.model_name,
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
            <Button variant='outline' onClick={() => setEditing(null)}>
              {t('Cancel')}
            </Button>
            <Button
              onClick={async () => {
                const draft = await editorRef.current?.commitDraft()
                if (!draft || !editing) return
                try {
                  const pricing = pricingFromDraft(draft)
                  setDrafts((prev) =>
                    prev.map((item) =>
                      item.model_name === editing.model_name
                        ? {
                            ...item,
                            pricing,
                            effective: { ...item.effective, ...pricing },
                            enabled: true,
                          }
                        : item
                    )
                  )
                  if (!limitEnabled) setLimitEnabled(true)
                  setEditing(null)
                } catch (error) {
                  handleServerError(error)
                }
              }}
            >
              {t('Apply')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
