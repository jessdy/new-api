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
import {
  Zap,
  Shield,
  Globe,
  Code,
  Gauge,
  DollarSign,
  Users,
  HeartHandshake,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'

interface FeaturesProps {
  className?: string
}

export function Features(_props: FeaturesProps) {
  const { t } = useTranslation()

  const commitments = [
    {
      id: 'fast',
      title: t('Lightning Fast'),
      desc: t(
        'Optimized network architecture ensures millisecond response times'
      ),
      icon: <Zap className='size-4' strokeWidth={1.75} />,
    },
    {
      id: 'secure',
      title: t('Secure & Reliable'),
      desc: t(
        'Enterprise-grade security with comprehensive permission management'
      ),
      icon: <Shield className='size-4' strokeWidth={1.75} />,
    },
    {
      id: 'global',
      title: t('Global Coverage'),
      desc: t('Multi-region deployment for stable global access'),
      icon: <Globe className='size-4' strokeWidth={1.75} />,
    },
    {
      id: 'developer',
      title: t('Developer Friendly'),
      desc: t('Compatible API routes for common AI application workflows'),
      icon: <Code className='size-4' strokeWidth={1.75} />,
    },
  ]

  const additionalFeatures = [
    {
      icon: <Gauge className='size-5' strokeWidth={1.5} />,
      title: t('High Performance'),
      desc: t('Support for high concurrency with automatic load balancing'),
    },
    {
      icon: <DollarSign className='size-5' strokeWidth={1.5} />,
      title: t('Transparent Billing'),
      desc: t('Pay-as-you-go with real-time usage monitoring'),
    },
    {
      icon: <Users className='size-5' strokeWidth={1.5} />,
      title: t('Team Collaboration'),
      desc: t('Multi-user management with flexible permission allocation'),
    },
    {
      icon: <HeartHandshake className='size-5' strokeWidth={1.5} />,
      title: t('Open Source'),
      desc: t('Community driven, self-hosted, and extensible'),
    },
  ]

  return (
    <section className='relative z-10 px-6 py-24 md:py-28'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-14 max-w-3xl md:mb-16'>
          <p className='text-brand-from dark:text-brand-to mb-3 flex items-center gap-2 text-xs font-medium tracking-[0.18em] uppercase'>
            <span className='bg-brand-from size-1.5 rounded-full' />
            {t('Core Features')}
          </p>
          <h2 className='text-3xl leading-tight font-bold tracking-tight md:text-[2.5rem]'>
            {t('Built for developers,')}
            <br />
            <span className='text-muted-foreground'>
              {t('designed for scale')}
            </span>
          </h2>
        </AnimateInView>

        <div className='grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8'>
          {commitments.map((f, i) => (
            <AnimateInView
              key={f.id}
              delay={i * 80}
              animation='fade-up'
              className='group flex flex-col'
            >
              <div className='text-muted-foreground bg-muted/40 group-hover:bg-brand-from/10 group-hover:text-brand-from dark:group-hover:text-brand-to mb-5 flex size-10 items-center justify-center rounded-md transition-colors'>
                {f.icon}
              </div>
              <h3 className='mb-2 text-base font-semibold tracking-tight'>
                {f.title}
              </h3>
              <p className='text-muted-foreground text-sm leading-relaxed'>
                {f.desc}
              </p>
            </AnimateInView>
          ))}
        </div>

        <div className='border-border/40 mt-16 grid grid-cols-2 gap-8 border-t pt-14 md:mt-20 md:grid-cols-4 md:gap-10'>
          {additionalFeatures.map((f, i) => (
            <AnimateInView
              key={f.title}
              delay={i * 80}
              animation='fade-up'
              className='flex flex-col items-start'
            >
              <div className='bg-brand-from/10 text-brand-from dark:bg-brand-from/15 dark:text-brand-to mb-3 flex size-10 items-center justify-center rounded-lg'>
                {f.icon}
              </div>
              <h3 className='mb-1.5 text-sm font-semibold'>{f.title}</h3>
              <p className='text-muted-foreground text-xs leading-relaxed'>
                {f.desc}
              </p>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
