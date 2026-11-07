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
import { Cpu, Network, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { useSystemConfig } from '@/hooks/use-system-config'

type AuthLayoutProps = {
  children: React.ReactNode
}

const BRAND_POINTS = [
  { key: 'Multi-protocol Compatible', icon: Network },
  { key: 'Transparent Billing', icon: Cpu },
  { key: 'Secure & Reliable', icon: ShieldCheck },
] as const

const PROTOCOL_CHIPS = [
  'OpenAI',
  'Claude',
  'Gemini',
  'Responses',
  'Realtime',
] as const

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation()
  const { systemName, logo, loading } = useSystemConfig()

  const brandMark = (
    <Link
      to='/'
      className='group inline-flex items-center gap-2.5 transition-opacity hover:opacity-80'
    >
      <div className='relative size-9 shrink-0'>
        {loading ? (
          <Skeleton className='absolute inset-0 rounded-xl' />
        ) : (
          <img
            src={logo}
            alt={t('Logo')}
            className='size-9 rounded-xl object-cover shadow-[0_0_24px_-4px_var(--brand-from)] ring-1 ring-white/20'
          />
        )}
      </div>
      {loading ? (
        <Skeleton className='h-6 w-28' />
      ) : (
        <span className='text-lg font-semibold tracking-tight'>
          {systemName}
        </span>
      )}
    </Link>
  )

  return (
    <div className='bg-background relative isolate min-h-svh overflow-hidden'>
      <div aria-hidden className='pointer-events-none absolute inset-0 -z-10'>
        <div
          className='absolute inset-0'
          style={{
            background: [
              'radial-gradient(ellipse 55% 45% at 12% 20%, oklch(0.69 0.15 280 / 28%) 0%, transparent 60%)',
              'radial-gradient(ellipse 45% 40% at 88% 75%, oklch(0.78 0.12 192 / 24%) 0%, transparent 62%)',
              'radial-gradient(ellipse 40% 30% at 70% 10%, oklch(0.72 0.1 230 / 14%) 0%, transparent 65%)',
            ].join(', '),
          }}
        />
        <div className='auth-tech-grid absolute inset-0 opacity-90 dark:opacity-50' />
        <div className='auth-tech-scan absolute inset-x-0 top-0 h-40 opacity-40 dark:opacity-30' />
      </div>

      <div className='relative mx-auto grid min-h-svh w-full max-w-7xl lg:grid-cols-2'>
        <aside className='relative hidden flex-col justify-between p-10 lg:flex xl:p-14'>
          <div
            aria-hidden
            className='pointer-events-none absolute inset-0 -z-10'
          >
            <div
              className='absolute inset-0'
              style={{
                background: [
                  'radial-gradient(ellipse 80% 60% at 20% 30%, oklch(0.69 0.15 280 / 32%) 0%, transparent 55%)',
                  'radial-gradient(ellipse 60% 50% at 80% 70%, oklch(0.78 0.12 192 / 26%) 0%, transparent 58%)',
                ].join(', '),
              }}
            />
            <div className='absolute top-1/2 right-[-12%] size-[min(38rem,70vh)] -translate-y-1/2'>
              <div className='auth-tech-orbit border-brand-from/25 absolute inset-0 rounded-full border border-dashed' />
              <div
                className='auth-tech-orbit border-brand-to/20 absolute inset-[12%] rounded-full border'
                style={{
                  animationDirection: 'reverse',
                  animationDuration: '26s',
                }}
              />
              <div className='absolute inset-[28%] rounded-full bg-[radial-gradient(circle,var(--brand-from)_0%,transparent_70%)] opacity-25 blur-2xl' />
              <span className='bg-brand-to auth-tech-pulse absolute top-[8%] left-1/2 size-2 -translate-x-1/2 rounded-full shadow-[0_0_16px_var(--brand-to)]' />
              <span
                className='bg-brand-from auth-tech-pulse absolute bottom-[14%] left-[18%] size-1.5 rounded-full shadow-[0_0_14px_var(--brand-from)]'
                style={{ animationDelay: '0.8s' }}
              />
            </div>
          </div>

          <div>{brandMark}</div>

          <div className='max-w-lg space-y-8'>
            <div className='space-y-4'>
              <p className='border-brand-from/30 bg-brand-from/10 text-brand-from dark:text-brand-to inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] font-medium tracking-[0.16em] uppercase backdrop-blur'>
                <span className='bg-brand-to auth-tech-pulse size-1.5 rounded-full shadow-[0_0_8px_var(--brand-to)]' />
                {t('AI Application Infrastructure Foundation')}
              </p>
              <h1 className='text-4xl leading-[1.12] font-bold tracking-tight xl:text-5xl'>
                <span className='block'>{t('Unified API Gateway for')}</span>
                <span className='from-brand-from to-brand-to mt-1 block bg-gradient-to-r bg-clip-text text-transparent drop-shadow-[0_0_24px_color-mix(in_oklch,var(--brand-from)_35%,transparent)]'>
                  {t('Vast Range of AI Models')}
                </span>
              </h1>
              <p className='text-muted-foreground max-w-md text-base leading-relaxed'>
                {t(
                  'Model access, intelligent routing, and token scheduling for AI applications'
                )}
              </p>
            </div>

            <ul className='space-y-3'>
              {BRAND_POINTS.map((point) => {
                const Icon = point.icon
                return (
                  <li
                    key={point.key}
                    className='bg-background/40 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ring-1 ring-white/10 backdrop-blur-sm'
                  >
                    <span className='from-brand-from to-brand-to flex size-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-white shadow-[0_0_18px_-4px_var(--brand-from)]'>
                      <Icon aria-hidden className='size-4' />
                    </span>
                    <span className='text-foreground/90'>{t(point.key)}</span>
                  </li>
                )
              })}
            </ul>

            <div className='flex flex-wrap gap-2'>
              {PROTOCOL_CHIPS.map((chip) => (
                <span
                  key={chip}
                  className='text-muted-foreground bg-muted/40 rounded-md px-2.5 py-1 font-mono text-[11px] tracking-wide'
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <p className='text-muted-foreground/70 font-mono text-xs tracking-wide'>
            {t('One account for every model and protocol')}
          </p>
        </aside>

        <main className='relative flex min-h-svh flex-col'>
          <div className='flex items-center px-5 pt-5 sm:px-8 sm:pt-8 lg:hidden'>
            {brandMark}
          </div>

          <div className='flex flex-1 items-center justify-center px-4 py-10 sm:px-8 sm:py-12'>
            <div className='auth-tech-card bg-card/70 w-full max-w-[440px] rounded-xl p-6 shadow-[0_24px_80px_-28px_color-mix(in_oklch,var(--brand-from)_45%,transparent)] backdrop-blur-xl sm:p-8'>
              <span
                aria-hidden
                className='from-brand-from to-brand-to absolute inset-x-8 top-0 h-px bg-gradient-to-r opacity-80'
              />
              <span
                aria-hidden
                className='border-brand-to/50 absolute top-3 left-3 size-3 border-t border-l'
              />
              <span
                aria-hidden
                className='border-brand-from/50 absolute right-3 bottom-3 size-3 border-r border-b'
              />
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
