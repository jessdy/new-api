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

import { CopyButton } from '@/components/copy-button'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { generateAffiliateLink } from '@/features/wallet/lib/affiliate'
import { handleServerError } from '@/lib/handle-server-error'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import {
  getAgentSelf,
  listAgentChannels,
  listAgentSettlement,
  replaceAgentChannels,
} from './api'
import { AgentPaymentPanel } from './components/agent-payment-panel'
import { AgentPricingPanel } from './components/agent-pricing-panel'
import { AgentUsersPanel } from './components/agent-users-panel'
import {
  AGENT_DEFAULT_SECTION,
  type AgentSectionId,
  isAgentSectionId,
} from './section-registry'

const agentRouteApi = getRouteApi('/_authenticated/agent/$section')

export function AgentConsole() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const params = agentRouteApi.useParams()
  const search = agentRouteApi.useSearch()
  const agentId = search.agent_id
  const section: AgentSectionId = isAgentSectionId(params.section)
    ? params.section
    : AGENT_DEFAULT_SECTION
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
            <div className='mb-4 space-y-2'>
              <p className='text-muted-foreground text-sm'>
                {selfQuery.data
                  ? t(
                      'Invite code: {{code}} · Debt: {{debt}} / Credit: {{credit}}',
                      {
                        code: selfQuery.data.invite_code,
                        debt: selfQuery.data.settlement_debt,
                        credit: selfQuery.data.credit_limit,
                      }
                    )
                  : t(
                      'Manage channels, pricing, users, and payment for your reseller account.'
                    )}
              </p>
              {selfQuery.data?.invite_code ? (
                <div className='flex flex-wrap items-center gap-2 text-sm'>
                  <span className='text-muted-foreground'>
                    {t('Invite registration link')}
                  </span>
                  <code className='bg-muted max-w-full truncate rounded px-2 py-1'>
                    {generateAffiliateLink(selfQuery.data.invite_code)}
                  </code>
                  <CopyButton
                    value={generateAffiliateLink(selfQuery.data.invite_code)}
                    variant='outline'
                    size='sm'
                    aria-label={t('Copy invite link')}
                  />
                </div>
              ) : null}
            </div>
            {section === 'channels' ? (
              <AgentChannelsPanel
                agentId={agentId}
                onSaved={() =>
                  queryClient.invalidateQueries({ queryKey: ['agent'] })
                }
              />
            ) : null}
            {section === 'pricing' ? (
              <AgentPricingPanel agentId={agentId} />
            ) : null}
            {section === 'users' ? (
              <AgentUsersPanel agentId={agentId} />
            ) : null}
            {section === 'payment' ? (
              <AgentPaymentPanel agentId={agentId} />
            ) : null}
            {section === 'settlement' ? (
              <AgentSettlementPanel agentId={agentId} />
            ) : null}
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
