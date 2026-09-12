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
along with this program. If you did not, see <https://www.gnu.org/licenses/>.
*/
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { CopyButton } from '@/components/copy-button'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { generateAffiliateLink } from '@/features/wallet/lib/affiliate'
import { handleServerError } from '@/lib/handle-server-error'

import {
  listAgentUsers,
  updateAgentUser,
  type AgentMemberRole,
  type AgentUser,
} from '../api'

function memberRole(user: AgentUser): AgentMemberRole {
  return user.agent_member_role === 'sales' ? 'sales' : 'user'
}

export function AgentUsersPanel(props: { agentId?: number }) {
  const { t } = useTranslation()
  const usersQuery = useQuery({
    queryKey: ['agent', 'users', props.agentId],
    queryFn: () => listAgentUsers(1, 50, props.agentId),
  })
  const roleMutation = useMutation({
    mutationFn: (input: { userId: number; role: AgentMemberRole }) =>
      updateAgentUser(
        input.userId,
        { agent_member_role: input.role },
        props.agentId
      ),
    onSuccess: () => {
      toast.success(t('Member role updated'))
      void usersQuery.refetch()
    },
    onError: (error) => handleServerError(error),
  })

  if (usersQuery.isLoading) {
    return <LoadingState message={t('Loading users…')} />
  }
  if (usersQuery.isError) {
    return (
      <ErrorState
        title={t('Failed to load agent users')}
        onRetry={() => {
          void usersQuery.refetch()
        }}
      />
    )
  }
  const users = usersQuery.data?.items ?? []
  if (users.length === 0) {
    return (
      <EmptyState
        title={t('No users yet')}
        description={t(
          "Users registered with your invite code or a salesperson's invite code appear here."
        )}
        bordered
      />
    )
  }
  return (
    <div className='space-y-3'>
      <p className='text-muted-foreground text-sm'>
        {t(
          'Sales and end users share channels, pricing, and your payment gateway. Sales promote with their own invite link.'
        )}
      </p>
      <div className='space-y-2'>
        {users.map((user) => {
          const role = memberRole(user)
          const isSales = role === 'sales'
          const inviteLink = user.aff_code
            ? generateAffiliateLink(user.aff_code)
            : ''
          return (
            <div key={user.id} className='space-y-2 rounded-md border p-3 text-sm'>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='font-medium'>
                  #{user.id} {user.username}
                </span>
                <Badge variant={isSales ? 'default' : 'secondary'}>
                  {isSales ? t('Sales') : t('End user')}
                </Badge>
              </div>
              <div className='text-muted-foreground'>
                {t('Group')}: {user.group} · {t('Quota')}: {user.quota}
                {user.inviter_username
                  ? ` · ${t('Invited by')}: ${user.inviter_username}`
                  : ''}
              </div>
              {user.aff_code ? (
                <div className='flex flex-wrap items-center gap-2'>
                  <span>
                    {t('Invite code')}: {user.aff_code}
                  </span>
                  {inviteLink ? (
                    <CopyButton
                      value={inviteLink}
                      variant='outline'
                      size='sm'
                      aria-label={t('Copy invite link')}
                    />
                  ) : null}
                </div>
              ) : null}
              <Button
                variant='outline'
                size='sm'
                disabled={roleMutation.isPending}
                onClick={() =>
                  roleMutation.mutate({
                    userId: user.id,
                    role: isSales ? 'user' : 'sales',
                  })
                }
              >
                {isSales ? t('Mark as end user') : t('Mark as sales')}
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
