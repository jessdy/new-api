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
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { handleServerError } from '@/lib/handle-server-error'

import {
  adminCreateAgent,
  adminCreateSettlementBill,
  adminListAgents,
  adminMarkSettlementBillPaid,
  adminUpdateAgent,
} from '../agent/api'

export function AgentsAdmin() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const agentsQuery = useQuery({
    queryKey: ['admin', 'agents'],
    queryFn: () => adminListAgents(1, 50),
  })
  const [userRef, setUserRef] = useState('')
  const [name, setName] = useState('')
  const [creditLimit, setCreditLimit] = useState('0')

  const createMutation = useMutation({
    mutationFn: (input: {
      userRef: string
      name: string
      creditLimit: string
    }) => {
      const trimmedUser = input.userRef.trim()
      const trimmedName = input.name.trim()
      if (!trimmedUser) {
        throw new Error(t('User ID or username is required'))
      }
      if (!trimmedName) {
        throw new Error(t('Agent name is required'))
      }
      const asId = Number(trimmedUser)
      const payload =
        Number.isInteger(asId) && asId > 0 && String(asId) === trimmedUser
          ? { user_id: asId }
          : { username: trimmedUser }
      return adminCreateAgent({
        ...payload,
        name: trimmedName,
        credit_limit: Number(input.creditLimit) || 0,
        status: 'enabled',
      })
    },
    onSuccess: () => {
      toast.success(t('Agent created'))
      setUserRef('')
      setName('')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] })
    },
    onError: (error) => handleServerError(error),
  })

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Agents')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='space-y-6'>
        <div className='text-muted-foreground text-sm'>
          {t('Approve resellers, set credit limits, and settle platform bills.')}{' '}
          {t('Tip: you can also make a user an agent from Users → row menu → Make Agent.')}
        </div>
        <form
          className='grid max-w-xl gap-3 rounded-md border p-4'
          onSubmit={(event) => {
            event.preventDefault()
            const fd = new FormData(event.currentTarget)
            createMutation.mutate({
              userRef: String(fd.get('user_ref') ?? '').trim() || userRef,
              name: String(fd.get('name') ?? '').trim() || name,
              creditLimit:
                String(fd.get('credit_limit') ?? '').trim() || creditLimit,
            })
          }}
        >
          <Label htmlFor='agent-user-ref'>{t('User ID or username')}</Label>
          <Input
            id='agent-user-ref'
            name='user_ref'
            value={userRef}
            placeholder={t('e.g. 12 or alice')}
            onChange={(e) => setUserRef(e.target.value)}
            autoComplete='off'
          />
          <Label htmlFor='agent-name'>{t('Agent name')}</Label>
          <Input
            id='agent-name'
            name='name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete='off'
          />
          <Label htmlFor='agent-credit'>{t('Credit limit')}</Label>
          <Input
            id='agent-credit'
            name='credit_limit'
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
            autoComplete='off'
          />
          <Button type='submit' disabled={createMutation.isPending}>
            {t('Create agent')}
          </Button>
        </form>

        <div className='space-y-3'>
          {(agentsQuery.data?.items ?? []).map((agent) => (
            <div key={agent.id} className='space-y-2 rounded-md border p-4'>
              <div className='font-medium'>
                #{agent.id} {agent.name} · user #{agent.user_id}
              </div>
              <div className='text-muted-foreground text-sm'>
                {t('Invite code')}: {agent.invite_code} · {t('Status')}:{' '}
                {agent.status} · {t('Debt')}: {agent.settlement_debt} /{' '}
                {agent.credit_limit}
              </div>
              <div className='flex flex-wrap gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  render={
                    <Link to='/agent' search={{ agent_id: agent.id }} />
                  }
                >
                  {t('Manage console')}
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() =>
                    adminUpdateAgent(agent.id, {
                      status:
                        agent.status === 'enabled' ? 'disabled' : 'enabled',
                    })
                      .then(() => {
                        toast.success(t('Agent updated'))
                        void agentsQuery.refetch()
                      })
                      .catch(handleServerError)
                  }
                >
                  {agent.status === 'enabled' ? t('Disable') : t('Enable')}
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    const now = Math.floor(Date.now() / 1000)
                    adminCreateSettlementBill(agent.id, {
                      period_start: now - 86400 * 30,
                      period_end: now,
                    })
                      .then(() => toast.success(t('Settlement bill created')))
                      .catch(handleServerError)
                  }}
                >
                  {t('Create bill')}
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    const billId = window.prompt(t('Enter bill ID to mark paid'))
                    if (!billId) return
                    adminMarkSettlementBillPaid(Number(billId))
                      .then(() => {
                        toast.success(t('Bill marked paid'))
                        void agentsQuery.refetch()
                      })
                      .catch(handleServerError)
                  }}
                >
                  {t('Mark bill paid')}
                </Button>
              </div>
            </div>
          ))}
        </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
