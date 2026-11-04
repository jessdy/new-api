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
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { useSystemConfig } from '@/hooks/use-system-config'

type AuthLayoutProps = {
  children: React.ReactNode
}

const BRAND_POINTS = [
  'Multi-protocol Compatible',
  'Transparent Billing',
  'Secure & Reliable',
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
            className='size-9 rounded-xl object-cover shadow-sm ring-1 ring-black/5 dark:ring-white/10'
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
    <div className='bg-background relative min-h-svh overflow-hidden'>
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10'
        style={{
          background: [
            'radial-gradient(ellipse 55% 45% at 12% 20%, oklch(0.69 0.15 280 / 22%) 0%, transparent 60%)',
            'radial-gradient(ellipse 45% 40% at 88% 75%, oklch(0.78 0.12 192 / 18%) 0%, transparent 62%)',
            'radial-gradient(ellipse 40% 30% at 70% 10%, oklch(0.72 0.1 230 / 10%) 0%, transparent 65%)',
          ].join(', '),
        }}
      />

      <div className='relative grid min-h-svh lg:grid-cols-2'>
        <aside className='relative hidden flex-col justify-between overflow-hidden border-r border-border/40 p-10 lg:flex xl:p-14'>
          <div
            aria-hidden
            className='pointer-events-none absolute inset-0 -z-10'
            style={{
              background: [
                'radial-gradient(ellipse 80% 60% at 20% 30%, oklch(0.69 0.15 280 / 28%) 0%, transparent 55%)',
                'radial-gradient(ellipse 60% 50% at 80% 70%, oklch(0.78 0.12 192 / 22%) 0%, transparent 58%)',
              ].join(', '),
            }}
          />

          <div>{brandMark}</div>

          <div className='max-w-lg space-y-8'>
            <div className='space-y-4'>
              <p className='text-brand-from dark:text-brand-to inline-flex items-center gap-2 text-xs font-medium tracking-[0.18em] uppercase'>
                <span className='bg-brand-from size-1.5 rounded-full' />
                {t('AI Application Infrastructure Foundation')}
              </p>
              <h1 className='text-4xl leading-[1.12] font-bold tracking-tight xl:text-5xl'>
                <span className='block'>{t('Unified API Gateway for')}</span>
                <span className='from-brand-from to-brand-to mt-1 block bg-gradient-to-r bg-clip-text text-transparent'>
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
              {BRAND_POINTS.map((point) => (
                <li
                  key={point}
                  className='text-foreground/85 flex items-center gap-3 text-sm font-medium'
                >
                  <span className='from-brand-from to-brand-to flex size-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-[10px] text-white'>
                    ✓
                  </span>
                  {t(point)}
                </li>
              ))}
            </ul>
          </div>

          <p className='text-muted-foreground/70 text-sm'>
            {t('One account for every model and protocol')}
          </p>
        </aside>

        <main className='relative flex min-h-svh flex-col'>
          <div className='flex items-center px-5 pt-5 sm:px-8 sm:pt-8 lg:hidden'>
            {brandMark}
          </div>

          <div className='flex flex-1 items-center justify-center px-4 py-10 sm:px-8 sm:py-12'>
            <div className='border-border/50 bg-card/75 w-full max-w-[440px] rounded-lg border p-6 shadow-[0_24px_80px_-28px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-8'>
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
