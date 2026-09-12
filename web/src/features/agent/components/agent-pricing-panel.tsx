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
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GroupRatioForm } from '@/features/system-settings/models/group-ratio-form'
import type { GroupFormValues } from '@/features/system-settings/models/group-ratio-form'
import { handleServerError } from '@/lib/handle-server-error'

import {
  listAgentGroups,
  listAgentModelPrices,
  upsertAgentGroup,
  upsertAgentModelPrice,
  type AgentGroupPricingView,
} from '../api'

type AgentPricingPanelProps = {
  agentId?: number
}

function emptyPricing(): AgentGroupPricingView {
  return {
    group_ratio: { default: 1 },
    topup_group_ratio: { default: 1 },
    user_usable_groups: { default: 'Default' },
    group_group_ratio: {},
    auto_groups: [],
    max_token_auto_groups: 0,
    default_use_auto_group: false,
    group_special_usable_group: {},
  }
}

function stringifyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2)
}

function toFormValues(view: AgentGroupPricingView): GroupFormValues {
  return {
    GroupRatio: stringifyJson(view.group_ratio),
    TopupGroupRatio: stringifyJson(view.topup_group_ratio),
    UserUsableGroups: stringifyJson(view.user_usable_groups),
    GroupGroupRatio: stringifyJson(view.group_group_ratio),
    AutoGroups: stringifyJson(view.auto_groups ?? []),
    MaxTokenAutoGroups: view.max_token_auto_groups || 1,
    DefaultUseAutoGroup: Boolean(view.default_use_auto_group),
    GroupSpecialUsableGroup: stringifyJson(view.group_special_usable_group),
  }
}

function parseRecord<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function fromFormValues(values: GroupFormValues): AgentGroupPricingView {
  return {
    group_ratio: parseRecord<Record<string, number>>(values.GroupRatio, {}),
    topup_group_ratio: parseRecord<Record<string, number>>(
      values.TopupGroupRatio,
      {}
    ),
    user_usable_groups: parseRecord<Record<string, string>>(
      values.UserUsableGroups,
      {}
    ),
    group_group_ratio: parseRecord<Record<string, Record<string, number>>>(
      values.GroupGroupRatio,
      {}
    ),
    auto_groups: parseRecord<string[]>(values.AutoGroups, []),
    max_token_auto_groups: Number(values.MaxTokenAutoGroups) || 0,
    default_use_auto_group: Boolean(values.DefaultUseAutoGroup),
    group_special_usable_group: parseRecord<
      Record<string, Record<string, string>>
    >(values.GroupSpecialUsableGroup, {}),
  }
}

export function AgentPricingPanel(props: AgentPricingPanelProps) {
  const { t } = useTranslation()
  const groupsQuery = useQuery({
    queryKey: ['agent', 'group-pricing', props.agentId],
    queryFn: () => listAgentGroups(props.agentId),
  })
  const pricesQuery = useQuery({
    queryKey: ['agent', 'model-prices', props.agentId],
    queryFn: () => listAgentModelPrices(props.agentId),
  })
  const [modelName, setModelName] = useState('')
  const [discount, setDiscount] = useState('1')

  const form = useForm<GroupFormValues>({
    defaultValues: toFormValues(emptyPricing()),
  })

  useEffect(() => {
    if (!groupsQuery.data) return
    form.reset(toFormValues(groupsQuery.data))
  }, [form, groupsQuery.data])

  const saveGroup = useMutation({
    mutationFn: (values: GroupFormValues) =>
      upsertAgentGroup(fromFormValues(values), props.agentId),
    onSuccess: (data) => {
      toast.success(t('Group saved'))
      form.reset(toFormValues(data))
      void groupsQuery.refetch()
    },
    onError: (error) => handleServerError(error),
  })

  const savePrice = useMutation({
    mutationFn: () =>
      upsertAgentModelPrice(
        {
          model: modelName,
          discount_ratio: Number(discount),
        },
        props.agentId
      ),
    onSuccess: () => {
      toast.success(t('Model discount saved'))
      void pricesQuery.refetch()
    },
    onError: (error) => handleServerError(error),
  })

  return (
    <div className='space-y-8'>
      <div className='space-y-3'>
        <div>
          <h3 className='font-medium'>{t('Group pricing')}</h3>
          <p className='text-muted-foreground text-sm'>
            {t(
              'These group ratios become the pricing system for users under this agent.'
            )}
          </p>
        </div>
        <GroupRatioForm
          form={form}
          onSave={async (values) => {
            await saveGroup.mutateAsync(values)
          }}
          isSaving={saveGroup.isPending}
          showLocalSaveButton
        />
      </div>
      <div className='space-y-3'>
        <h3 className='font-medium'>{t('Model discount')}</h3>
        <div className='grid max-w-xl gap-2'>
          <Label>{t('Model')}</Label>
          <Input
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
          />
          <Label>{t('Discount ratio')}</Label>
          <Input
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
          <Button onClick={() => savePrice.mutate()}>
            {t('Save discount')}
          </Button>
        </div>
        <ul className='text-muted-foreground space-y-1 text-sm'>
          {(pricesQuery.data ?? []).map((price) => (
            <li key={price.model}>
              {price.model}: {price.discount_ratio}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
