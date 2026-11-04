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

import { AnimateInView } from '@/components/animate-in-view'

export function HowItWorks() {
  const { t } = useTranslation()

  const steps = [
    {
      num: '01',
      title: t('Configure'),
      desc: t(
        'Add your API keys, set up channels and configure access permissions'
      ),
      to: '/sign-up' as const,
    },
    {
      num: '02',
      title: t('Connect'),
      desc: t(
        'Connect through OpenAI, Claude, Gemini, and other compatible API routes'
      ),
      to: '/pricing' as const,
    },
    {
      num: '03',
      title: t('Monitor'),
      desc: t('Track usage, costs and performance with real-time analytics'),
      to: '/dashboard' as const,
    },
  ]

  return (
    <section className='relative z-10 border-t border-brand-from/10 px-6 py-24 md:py-28'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-14 text-center md:mb-16'>
          <p className='text-brand-from dark:text-brand-to mb-3 inline-flex items-center gap-2 text-xs font-medium tracking-[0.18em] uppercase'>
            <span className='bg-brand-from size-1.5 rounded-full' />
            {t('How It Works')}
          </p>
          <h2 className='text-3xl font-bold tracking-tight md:text-[2.5rem]'>
            {t('Three steps to get started')}
          </h2>
        </AnimateInView>

        <ol className='grid gap-6 md:grid-cols-3 md:gap-8'>
          {steps.map((step, i) => (
            <AnimateInView
              key={step.num}
              delay={i * 120}
              animation='fade-up'
              className='relative'
            >
              <Link
                to={step.to}
                className='border-border/40 bg-card/20 hover:border-brand-from/30 hover:bg-brand-from/[0.04] group block rounded-lg border p-7 transition-colors md:p-8'
              >
                <div className='from-brand-from to-brand-to mb-5 bg-gradient-to-br bg-clip-text text-4xl font-bold tracking-tight text-transparent tabular-nums md:text-5xl'>
                  {step.num}
                </div>
                <h3 className='group-hover:text-brand-from dark:group-hover:text-brand-to mb-2 text-lg font-semibold'>
                  {step.title}
                </h3>
                <p className='text-muted-foreground text-sm leading-relaxed'>
                  {step.desc}
                </p>
              </Link>
            </AnimateInView>
          ))}
        </ol>
      </div>
    </section>
  )
}
