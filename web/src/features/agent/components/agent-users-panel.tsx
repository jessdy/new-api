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
*/
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { CopyButton } from '@/components/copy-button'
import {
  StaticDataTable,
  type StaticDataTableColumn,
} from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { UserQuotaDialog } from '@/features/users/components/user-quota-dialog'
import { generateAffiliateLink } from '@/features/wallet/lib/affiliate'
import { formatQuota } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'

import {
  adjustAgentUserQuota,
  listAgentUsers,
  updateAgentUser,
  type AgentMemberRole,
  type AgentUser,
} from '../api'
import { AgentUserModelSettingsDialog } from './agent-user-model-settings-dialog'

function memberRole(user: AgentUser): AgentMemberRole {
  return user.agent_member_role === 'sales' ? 'sales' : 'user'
}

export function AgentUsersPanel(props: { agentId?: number }) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('')
  const [quotaUser, setQuotaUser] = useState<AgentUser | null>(null)
  const [modelsUser, setModelsUser] = useState<AgentUser | null>(null)
  const [remarkUser, setRemarkUser] = useState<AgentUser | null>(null)
  const [remarkDraft, setRemarkDraft] = useState('')
  const usersQuery = useQuery({
    queryKey: ['agent', 'users', props.agentId],
    queryFn: () => listAgentUsers(1, 100, props.agentId),
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
  const remarkMutation = useMutation({
    mutationFn: (input: { userId: number; remark: string }) =>
      updateAgentUser(
        input.userId,
        { agent_remark: input.remark },
        props.agentId
      ),
    onSuccess: () => {
      toast.success(t('Remark saved'))
      setRemarkUser(null)
      void usersQuery.refetch()
    },
    onError: (error) => handleServerError(error),
  })

  const users = usersQuery.data?.items ?? []
  const filtered = useMemo(() => {
    const rows = usersQuery.data?.items ?? []
    const q = filter.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (user) =>
        user.username.toLowerCase().includes(q) ||
        user.display_name?.toLowerCase().includes(q) ||
        user.agent_remark?.toLowerCase().includes(q) ||
        String(user.id).includes(q)
    )
  }, [filter, usersQuery.data?.items])

  const columns = useMemo<StaticDataTableColumn<AgentUser>[]>(
    () => [
      {
        id: 'user',
        header: t('User'),
        cell: (user) => {
          const role = memberRole(user)
          const isSales = role === 'sales'
          return (
            <div className='space-y-1'>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='font-medium'>
                  #{user.id} {user.username}
                </span>
                <Badge variant={isSales ? 'default' : 'secondary'}>
                  {isSales ? t('Sales') : t('End user')}
                </Badge>
              </div>
              {user.display_name ? (
                <div className='text-muted-foreground text-xs'>
                  {user.display_name}
                </div>
              ) : null}
            </div>
          )
        },
      },
      {
        id: 'group',
        header: t('Group'),
        cell: (user) => user.group,
      },
      {
        id: 'remark',
        header: t('Remark'),
        cell: (user) =>
          user.agent_remark ? (
            <span
              className='line-clamp-2 max-w-56 text-sm'
              title={user.agent_remark}
            >
              {user.agent_remark}
            </span>
          ) : (
            '—'
          ),
      },
      {
        id: 'quota',
        header: t('Quota'),
        cell: (user) => formatQuota(user.quota),
      },
      {
        id: 'inviter',
        header: t('Invited by'),
        cell: (user) => user.inviter_username || '—',
      },
      {
        id: 'invite',
        header: t('Invite code'),
        cell: (user) =>
          user.aff_code ? (
            <div className='flex flex-wrap items-center gap-2'>
              <code className='text-xs'>{user.aff_code}</code>
              <CopyButton
                value={generateAffiliateLink(user.aff_code)}
                variant='outline'
                size='sm'
                aria-label={t('Copy invite link')}
              />
            </div>
          ) : (
            '—'
          ),
      },
      {
        id: 'actions',
        header: t('Actions'),
        cell: (user) => {
          const role = memberRole(user)
          const isSales = role === 'sales'
          return (
            <div className='flex flex-wrap gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  setRemarkDraft(user.agent_remark ?? '')
                  setRemarkUser(user)
                }}
              >
                {t('Remark')}
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setQuotaUser(user)}
              >
                {t('Adjust Quota')}
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setModelsUser(user)}
              >
                {t('Model Settings')}
              </Button>
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
        },
      },
    ],
    [roleMutation, t]
  )

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
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Sales and end users share channels, pricing, and your payment gateway. Sales promote with their own invite link.'
          )}
        </p>
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={t('Search users')}
          className='sm:max-w-xs'
        />
      </div>
      <StaticDataTable
        columns={columns}
        data={filtered}
        getRowKey={(user) => user.id}
      />
      {quotaUser ? (
        <UserQuotaDialog
          open
          onOpenChange={(open) => {
            if (!open) setQuotaUser(null)
          }}
          userId={quotaUser.id}
          currentQuota={quotaUser.quota}
          adjustFn={async (payload) =>
            adjustAgentUserQuota(
              payload.id,
              { mode: payload.mode, value: payload.value },
              props.agentId
            )
          }
          onSuccess={() => {
            setQuotaUser(null)
            void usersQuery.refetch()
          }}
        />
      ) : null}
      <Dialog
        open={remarkUser !== null}
        onOpenChange={(open) => {
          if (!open) setRemarkUser(null)
        }}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('Remark')}</DialogTitle>
            <DialogDescription>
              {remarkUser
                ? `#${remarkUser.id} ${remarkUser.username}`
                : t('Add a note about this user')}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-2'>
            <Label htmlFor='agent-user-remark'>
              {t('Add a note about this user')}
            </Label>
            <Textarea
              id='agent-user-remark'
              value={remarkDraft}
              maxLength={255}
              rows={4}
              onChange={(event) => setRemarkDraft(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setRemarkUser(null)}
              disabled={remarkMutation.isPending}
            >
              {t('Cancel')}
            </Button>
            <Button
              onClick={() => {
                if (!remarkUser) return
                remarkMutation.mutate({
                  userId: remarkUser.id,
                  remark: remarkDraft,
                })
              }}
              disabled={remarkMutation.isPending}
            >
              {t('Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {modelsUser ? (
        <AgentUserModelSettingsDialog
          open
          onOpenChange={(open) => {
            if (!open) setModelsUser(null)
          }}
          user={modelsUser}
          agentId={props.agentId}
        />
      ) : null}
    </div>
  )
}
