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
  const [userId, setUserId] = useState('')
  const [name, setName] = useState('')
  const [creditLimit, setCreditLimit] = useState('0')

  const createMutation = useMutation({
    mutationFn: () =>
      adminCreateAgent({
        user_id: Number(userId),
        name,
        credit_limit: Number(creditLimit) || 0,
        status: 'enabled',
      }),
    onSuccess: () => {
      toast.success(t('Agent created'))
      setUserId('')
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
          {t('Approve resellers, set credit limits, and settle platform bills.')}
        </div>
        <div className='grid max-w-xl gap-3 rounded-md border p-4'>
          <Label>{t('User ID')}</Label>
          <Input value={userId} onChange={(e) => setUserId(e.target.value)} />
          <Label>{t('Agent name')}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <Label>{t('Credit limit')}</Label>
          <Input
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
          />
          <Button onClick={() => createMutation.mutate()}>
            {t('Create agent')}
          </Button>
        </div>

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
