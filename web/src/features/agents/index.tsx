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

import { adminCreateAgent, adminListAgents } from '../agent/api'
import { AgentsAdminTable } from './components/agents-admin-table'

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
            {t(
              'Approve resellers, set credit limits, and settle platform bills.'
            )}{' '}
            {t(
              'Tip: you can also make a user an agent from Users → row menu → Make Agent.'
            )}
          </div>

          <AgentsAdminTable
            agents={agentsQuery.data?.items ?? []}
            loading={agentsQuery.isLoading}
            error={agentsQuery.isError}
            onRetry={() => {
              void agentsQuery.refetch()
            }}
            onChanged={() => {
              void agentsQuery.refetch()
            }}
          />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
