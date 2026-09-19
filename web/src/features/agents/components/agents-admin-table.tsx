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
import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { CopyButton } from '@/components/copy-button'
import {
  StaticDataTable,
  staticDataTableClassNames,
  type StaticDataTableColumn,
} from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  adminMarkSettlementBillPaid,
  adminUpdateAgent,
  type AgentSummary,
} from '@/features/agent/api'
import { formatQuota } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'

type AgentsAdminTableProps = {
  agents: AgentSummary[]
  loading: boolean
  error: boolean
  onRetry: () => void
  onChanged: () => void
}

type PendingAction =
  | { type: 'toggle'; agent: AgentSummary }
  | { type: 'pay'; agent: AgentSummary }

function statusVariant(status: string) {
  if (status === 'enabled') return 'success'
  if (status === 'disabled') return 'danger'
  if (status === 'overdue') return 'warning'
  return 'neutral'
}

function statusLabelKey(status: string) {
  if (status === 'enabled') return 'Enabled'
  if (status === 'disabled') return 'Disabled'
  if (status === 'pending') return 'Pending'
  if (status === 'overdue') return 'Overdue'
  return status
}

export function AgentsAdminTable(props: AgentsAdminTableProps) {
  const { t } = useTranslation()
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [busy, setBusy] = useState(false)

  const columns = useMemo<StaticDataTableColumn<AgentSummary>[]>(
    () => [
      {
        id: 'user',
        header: t('Agent user'),
        cell: (agent) => (
          <div className='space-y-0.5'>
            <div className='font-medium'>
              {agent.username || `#${agent.user_id}`}
            </div>
            <div className='text-muted-foreground text-xs'>
              #{agent.id} {agent.name}
            </div>
          </div>
        ),
      },
      {
        id: 'invite_code',
        header: t('Channel code'),
        className: staticDataTableClassNames.codeCell,
        cell: (agent) =>
          agent.invite_code ? (
            <div className='flex items-center gap-2'>
              <code className='text-xs'>{agent.invite_code}</code>
              <CopyButton
                value={agent.invite_code}
                variant='outline'
                size='sm'
                aria-label={t('Copy')}
              />
            </div>
          ) : (
            '—'
          ),
      },
      {
        id: 'status',
        header: t('Status'),
        cell: (agent) => (
          <StatusBadge
            label={t(statusLabelKey(agent.status))}
            variant={statusVariant(agent.status)}
            copyable={false}
          />
        ),
      },
      {
        id: 'monthly_sales',
        header: t('Monthly sales'),
        className: staticDataTableClassNames.compactHeaderCellRight,
        cellClassName: staticDataTableClassNames.compactNumericCell,
        cell: (agent) => formatQuota(agent.monthly_sales ?? 0),
      },
      {
        id: 'total_sales',
        header: t('Total sales'),
        className: staticDataTableClassNames.compactHeaderCellRight,
        cellClassName: staticDataTableClassNames.compactNumericCell,
        cell: (agent) => formatQuota(agent.total_sales ?? 0),
      },
      {
        id: 'actions',
        header: t('Actions'),
        className: staticDataTableClassNames.actionHeaderCell,
        cellClassName: staticDataTableClassNames.actionCell,
        cell: (agent) => (
          <div className='flex flex-wrap justify-end gap-2'>
            <Button
              variant='outline'
              size='sm'
              render={
                <Link
                  to='/agent/$section'
                  params={{ section: 'channels' }}
                  search={{ agent_id: agent.id }}
                />
              }
            >
              {t('Manage console')}
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setPending({ type: 'toggle', agent })}
            >
              {agent.status === 'enabled' ? t('Disable') : t('Enable')}
            </Button>
            <Button
              variant='outline'
              size='sm'
              disabled={!agent.unpaid_bill_id}
              onClick={() => setPending({ type: 'pay', agent })}
            >
              {t('Mark bill paid')}
            </Button>
          </div>
        ),
      },
    ],
    [t]
  )

  const handleConfirm = async () => {
    if (!pending) return
    setBusy(true)
    try {
      if (pending.type === 'toggle') {
        await adminUpdateAgent(pending.agent.id, {
          status:
            pending.agent.status === 'enabled' ? 'disabled' : 'enabled',
        })
        toast.success(t('Agent updated'))
      } else if (pending.agent.unpaid_bill_id) {
        await adminMarkSettlementBillPaid(pending.agent.unpaid_bill_id)
        toast.success(t('Bill marked paid'))
      } else {
        toast.error(t('No unpaid settlement bill'))
      }
      setPending(null)
      props.onChanged()
    } catch (error) {
      handleServerError(error)
    } finally {
      setBusy(false)
    }
  }

  if (props.loading) {
    return <LoadingState />
  }
  if (props.error) {
    return (
      <ErrorState title={t('Failed to load agents')} onRetry={props.onRetry} />
    )
  }
  if (props.agents.length === 0) {
    return (
      <EmptyState
        title={t('No agents yet')}
        description={t('Create an agent to manage reseller channels.')}
        bordered
      />
    )
  }

  let confirmTitle = t('Disable')
  let confirmDesc = t('Disable this agent?')
  let confirmText = t('Disable')
  if (pending?.type === 'pay') {
    confirmTitle = t('Mark bill paid')
    confirmDesc = t('Mark the latest unpaid bill as paid?')
    confirmText = t('Mark bill paid')
  } else if (pending?.agent.status !== 'enabled') {
    confirmTitle = t('Enable')
    confirmDesc = t('Enable this agent?')
    confirmText = t('Enable')
  }

  return (
    <>
      <StaticDataTable
        columns={columns}
        data={props.agents}
        getRowKey={(agent) => agent.id}
      />
      <ConfirmDialog
        open={pending != null}
        onOpenChange={(open) => {
          if (!open && !busy) setPending(null)
        }}
        title={confirmTitle}
        desc={confirmDesc}
        confirmText={confirmText}
        destructive={
          pending?.type === 'toggle' && pending.agent.status === 'enabled'
        }
        isLoading={busy}
        handleConfirm={() => {
          void handleConfirm()
        }}
      />
    </>
  )
}
