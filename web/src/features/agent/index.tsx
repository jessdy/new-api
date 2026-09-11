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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { handleServerError } from '@/lib/handle-server-error'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import {
  getAgentPaymentConfig,
  getAgentSelf,
  listAgentChannels,
  listAgentGroups,
  listAgentModelPrices,
  listAgentSettlement,
  listAgentUsers,
  replaceAgentChannels,
  updateAgentPaymentConfig,
  upsertAgentGroup,
  upsertAgentModelPrice,
} from './api'

const agentRouteApi = getRouteApi('/_authenticated/agent/')

export function AgentConsole() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const search = agentRouteApi.useSearch()
  const agentId = search.agent_id
  const user = useAuthStore((s) => s.auth.user)
  const isAdmin = (user?.role ?? 0) >= ROLE.ADMIN
  const selfQuery = useQuery({
    queryKey: ['agent', 'self', agentId],
    queryFn: () => getAgentSelf(agentId),
    retry: false,
  })

  // Admins without ?agent_id= only proceed if they themselves have an agent profile.
  const showAdminGuide =
    isAdmin && !agentId && selfQuery.isFetched && !selfQuery.data
  const showConsole = !isAdmin || Boolean(agentId) || Boolean(selfQuery.data)

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Agent Console')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        {showAdminGuide ? (
          <div className='space-y-3 rounded-md border p-4 text-sm'>
            <p>
              {t(
                'Administrators manage reseller settings from the Agents page. Open Manage console on a specific agent, or pass ?agent_id=.'
              )}
            </p>
            <Button render={<Link to='/agents' />}>{t('Go to Agents')}</Button>
          </div>
        ) : null}
        {showConsole ? (
          <>
        <div className='text-muted-foreground mb-4 text-sm'>
          {selfQuery.data
            ? t('Invite code: {{code}} · Debt: {{debt}} / Credit: {{credit}}', {
                code: selfQuery.data.invite_code,
                debt: selfQuery.data.settlement_debt,
                credit: selfQuery.data.credit_limit,
              })
            : t(
                'Manage channels, pricing, users, and payment for your reseller account.'
              )}
        </div>
        <Tabs defaultValue='channels'>
          <TabsList>
            <TabsTrigger value='channels'>{t('Channels')}</TabsTrigger>
            <TabsTrigger value='pricing'>{t('Pricing')}</TabsTrigger>
            <TabsTrigger value='users'>{t('Users')}</TabsTrigger>
            <TabsTrigger value='payment'>{t('Payment')}</TabsTrigger>
            <TabsTrigger value='settlement'>{t('Settlement')}</TabsTrigger>
          </TabsList>
          <TabsContent value='channels' className='mt-4'>
            <AgentChannelsPanel
              agentId={agentId}
              onSaved={() =>
                queryClient.invalidateQueries({ queryKey: ['agent'] })
              }
            />
          </TabsContent>
          <TabsContent value='pricing' className='mt-4'>
            <AgentPricingPanel agentId={agentId} />
          </TabsContent>
          <TabsContent value='users' className='mt-4'>
            <AgentUsersPanel agentId={agentId} />
          </TabsContent>
          <TabsContent value='payment' className='mt-4'>
            <AgentPaymentPanel agentId={agentId} />
          </TabsContent>
          <TabsContent value='settlement' className='mt-4'>
            <AgentSettlementPanel agentId={agentId} />
          </TabsContent>
        </Tabs>
          </>
        ) : null}
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function AgentChannelsPanel(props: {
  agentId?: number
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const channelsQuery = useQuery({
    queryKey: ['agent', 'channels', props.agentId],
    queryFn: () => listAgentChannels(props.agentId),
  })
  const [selected, setSelected] = useState<number[] | null>(null)
  const current =
    selected ??
    (channelsQuery.data ?? [])
      .filter((item) => item.selected)
      .map((item) => item.id)

  const saveMutation = useMutation({
    mutationFn: () => replaceAgentChannels(current, props.agentId),
    onSuccess: () => {
      toast.success(t('Channels saved'))
      props.onSaved()
      void channelsQuery.refetch()
    },
    onError: (error) => handleServerError(error),
  })

  return (
    <div className='space-y-4'>
      <div className='flex justify-end'>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {t('Save selected channels')}
        </Button>
      </div>
      <div className='grid gap-2'>
        {(channelsQuery.data ?? []).map((channel) => {
          const checked = current.includes(channel.id)
          return (
            <label
              key={channel.id}
              className='flex items-start gap-3 rounded-md border p-3'
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(value) => {
                  const next = new Set(current)
                  if (value) next.add(channel.id)
                  else next.delete(channel.id)
                  setSelected([...next])
                }}
              />
              <div className='space-y-1'>
                <div className='font-medium'>
                  #{channel.id} {channel.name}
                </div>
                <div className='text-muted-foreground text-sm'>
                  {channel.models.join(', ')}
                </div>
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}

function AgentPricingPanel(props: { agentId?: number }) {
  const { t } = useTranslation()
  const groupsQuery = useQuery({
    queryKey: ['agent', 'groups', props.agentId],
    queryFn: () => listAgentGroups(props.agentId),
  })
  const pricesQuery = useQuery({
    queryKey: ['agent', 'model-prices', props.agentId],
    queryFn: () => listAgentModelPrices(props.agentId),
  })
  const [groupName, setGroupName] = useState('default')
  const [groupRatio, setGroupRatio] = useState('1')
  const [modelName, setModelName] = useState('')
  const [discount, setDiscount] = useState('1')

  const saveGroup = useMutation({
    mutationFn: () =>
      upsertAgentGroup(
        {
          name: groupName,
          ratio: Number(groupRatio),
          topup_ratio: 1,
          enabled: true,
          is_default: groupName === 'default',
        },
        props.agentId
      ),
    onSuccess: () => {
      toast.success(t('Group saved'))
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
    <div className='grid gap-8 lg:grid-cols-2'>
      <div className='space-y-3'>
        <h3 className='font-medium'>{t('Group pricing')}</h3>
        <div className='grid gap-2'>
          <Label>{t('Group name')}</Label>
          <Input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <Label>{t('Ratio')}</Label>
          <Input
            value={groupRatio}
            onChange={(e) => setGroupRatio(e.target.value)}
          />
          <Button onClick={() => saveGroup.mutate()}>{t('Save group')}</Button>
        </div>
        <ul className='text-muted-foreground space-y-1 text-sm'>
          {(groupsQuery.data ?? []).map((group) => (
            <li key={group.name}>
              {group.name}: {group.ratio}
            </li>
          ))}
        </ul>
      </div>
      <div className='space-y-3'>
        <h3 className='font-medium'>{t('Model discount')}</h3>
        <div className='grid gap-2'>
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

function AgentUsersPanel(props: { agentId?: number }) {
  const { t } = useTranslation()
  const usersQuery = useQuery({
    queryKey: ['agent', 'users', props.agentId],
    queryFn: () => listAgentUsers(1, 50, props.agentId),
  })
  return (
    <div className='space-y-2'>
      {(usersQuery.data?.items ?? []).map((user) => (
        <div key={user.id} className='rounded-md border p-3 text-sm'>
          #{user.id} {user.username} · {t('Group')}: {user.group} ·{' '}
          {t('Quota')}: {user.quota}
        </div>
      ))}
      {!usersQuery.data?.items?.length ? (
        <div className='text-muted-foreground text-sm'>{t('No users yet')}</div>
      ) : null}
    </div>
  )
}

function AgentPaymentPanel(props: { agentId?: number }) {
  const { t } = useTranslation()
  const paymentQuery = useQuery({
    queryKey: ['agent', 'payment', props.agentId],
    queryFn: () => getAgentPaymentConfig(props.agentId),
  })
  const [payAddress, setPayAddress] = useState('')
  const [epayId, setEpayId] = useState('')
  const [epayKey, setEpayKey] = useState('')
  const [stripeSecret, setStripeSecret] = useState('')
  const [stripeWebhook, setStripeWebhook] = useState('')
  const [stripePriceId, setStripePriceId] = useState('')

  const saveMutation = useMutation({
    mutationFn: () =>
      updateAgentPaymentConfig(
        {
          epay_enabled: true,
          pay_address: payAddress || paymentQuery.data?.pay_address,
          epay_id: epayId || undefined,
          epay_key: epayKey || undefined,
          pay_methods: paymentQuery.data?.pay_methods?.length
            ? paymentQuery.data.pay_methods
            : [{ name: 'Alipay', type: 'alipay', color: '#1677FF' }],
          stripe_enabled: Boolean(
            stripeSecret || paymentQuery.data?.stripe_api_secret_set
          ),
          stripe_api_secret: stripeSecret || undefined,
          stripe_webhook_secret: stripeWebhook || undefined,
          stripe_price_id:
            stripePriceId || paymentQuery.data?.stripe_price_id,
        },
        props.agentId
      ),
    onSuccess: () => {
      toast.success(t('Payment settings saved'))
      void paymentQuery.refetch()
    },
    onError: (error) => handleServerError(error),
  })

  return (
    <div className='grid max-w-xl gap-3'>
      <Label>{t('Epay address')}</Label>
      <Input
        placeholder={paymentQuery.data?.pay_address || ''}
        value={payAddress}
        onChange={(e) => setPayAddress(e.target.value)}
      />
      <Label>{t('Epay ID')}</Label>
      <Input
        placeholder={paymentQuery.data?.epay_id || ''}
        value={epayId}
        onChange={(e) => setEpayId(e.target.value)}
      />
      <Label>{t('Epay key')}</Label>
      <Input
        type='password'
        value={epayKey}
        onChange={(e) => setEpayKey(e.target.value)}
      />
      <Label>{t('Stripe API secret')}</Label>
      <Input
        type='password'
        value={stripeSecret}
        onChange={(e) => setStripeSecret(e.target.value)}
      />
      <Label>{t('Stripe webhook secret')}</Label>
      <Input
        type='password'
        value={stripeWebhook}
        onChange={(e) => setStripeWebhook(e.target.value)}
      />
      <Label>{t('Stripe price ID')}</Label>
      <Input
        placeholder={paymentQuery.data?.stripe_price_id || ''}
        value={stripePriceId}
        onChange={(e) => setStripePriceId(e.target.value)}
      />
      <Button onClick={() => saveMutation.mutate()}>
        {t('Save payment settings')}
      </Button>
    </div>
  )
}

function AgentSettlementPanel(props: { agentId?: number }) {
  const { t } = useTranslation()
  const settlementQuery = useQuery({
    queryKey: ['agent', 'settlement', props.agentId],
    queryFn: () => listAgentSettlement(props.agentId),
  })
  return (
    <div className='space-y-3'>
      <div className='text-sm'>
        {t('Settlement debt')}: {settlementQuery.data?.settlement_debt ?? 0} /{' '}
        {t('Credit limit')}: {settlementQuery.data?.credit_limit ?? 0}
      </div>
      {(settlementQuery.data?.items ?? []).map((bill) => (
        <div key={String(bill.id)} className='rounded-md border p-3 text-sm'>
          #{String(bill.id)} · {String(bill.status)} ·{' '}
          {String(bill.platform_quota)}
        </div>
      ))}
    </div>
  )
}
