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
import { Building2, Gauge, Layers3, Route, Unplug } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { RichContent } from '@/components/rich-content'

type CompanyAboutProps = {
  extraContent?: string
  extraIsHtml?: boolean
}

function ProjectAttribution() {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  return (
    <div className='text-muted-foreground space-y-3 text-sm'>
      
      
    </div>
  )
}

export function CompanyAbout(props: CompanyAboutProps) {
  const { t } = useTranslation()
  const extraContent = props.extraContent?.trim() ?? ''
  const businessModules = [
    {
      module: t('Unified model API'),
      capability: t(
        'One API that matches common development workflows and standardizes calls to different models and vendors.'
      ),
      value: t(
        'Lower integration cost, less repeated work, and smooth switching between models.'
      ),
      icon: Unplug,
    },
    {
      module: t('Intelligent routing and failover'),
      capability: t(
        'Route each request by model capability, speed, availability, price, region, and task type, and fail over when a provider is down.'
      ),
      value: t(
        'Higher stability and success rate, without depending on a single vendor.'
      ),
      icon: Route,
    },
    {
      module: t('Token production scheduling'),
      capability: t(
        'Measure, allocate, schedule, and optimize request, context, reasoning, and output tokens in one place.'
      ),
      value: t('Make AI usage manageable, traceable, and open to improvement.'),
      icon: Gauge,
    },
    {
      module: t('Cost and usage management'),
      capability: t(
        'Analyze usage, control budgets, and account for spend by model, project, team, API key, and application.'
      ),
      value: t(
        'Give the company a clear AI cost model and clear usage limits.'
      ),
      icon: Layers3,
    },
    {
      module: t('Developer and enterprise services'),
      capability: t(
        'Serve individual developers, startup teams, and enterprises with a model catalog, credentials, access control, data policy, and operational support.'
      ),
      value: t(
        'Cover the full path from a quick trial to production at scale.'
      ),
      icon: Building2,
    },
  ]
  const platformLayers = [
    t('Model and compute supply'),
    t('Intelligent routing layer'),
    t('Developer and enterprise applications'),
  ]
  const brandKeywords = [
    t('Unified access'),
    t('Intelligent routing'),
    t('Token scheduling'),
    t('Transparent cost'),
    t('Stable and reliable'),
    t('Developer friendly'),
    t('Enterprise control'),
  ]

  return (
    <PublicLayout showMainContainer={false}>
      <article>
        <header className='relative overflow-hidden px-6 pt-28 pb-16 md:pt-36 md:pb-20'>
          <div
            aria-hidden
            className='pointer-events-none absolute inset-0 -z-10 opacity-25 dark:opacity-[0.12]'
            style={{
              background: [
                'radial-gradient(ellipse 60% 50% at 20% 20%, oklch(0.72 0.18 250 / 80%) 0%, transparent 70%)',
                'radial-gradient(ellipse 50% 40% at 80% 15%, oklch(0.65 0.15 200 / 60%) 0%, transparent 70%)',
              ].join(', '),
            }}
          />
          <div className='mx-auto max-w-6xl'>
            <p className='text-primary text-sm font-medium'>XTokenFactory</p>
            <h1 className='mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-pretty md:text-5xl'>
              {t('XTokenFactory company introduction')}
            </h1>
            <p className='text-muted-foreground mt-4 max-w-2xl text-lg'>
              {t(
                'Model access, intelligent routing, and token scheduling for AI applications'
              )}
            </p>
            <p className='mt-6 max-w-3xl text-base leading-7'>
              {t(
                'XTokenFactory is a technology company building infrastructure for the AI era. It connects scattered models, compute, and application demand, and gives developers and enterprises a unified, stable, observable, and continuously improvable way to call AI models and schedule tokens.'
              )}
            </p>
          </div>
        </header>

        <section className='px-6 py-12'>
          <div className='mx-auto max-w-6xl'>
            <h2 className='text-2xl font-semibold tracking-tight'>
              {t('What we solve')}
            </h2>
            <p className='text-muted-foreground mt-4 max-w-3xl leading-7'>
              {t(
                'As large models multiply, companies shipping AI products have to deal with many vendors, incompatible APIs, price differences, unstable service, data compliance, and costs that are hard to control. XTokenFactory hides model selection and vendor management behind one API and intelligent scheduling, so customers can focus on the product, the business, and the user experience.'
              )}
            </p>
          </div>
        </section>

        <section className='px-6 py-12'>
          <div className='mx-auto max-w-6xl'>
            <h2 className='text-2xl font-semibold tracking-tight'>
              {t('Core business model')}
            </h2>
            <div className='mt-6 grid gap-4 lg:grid-cols-2'>
              {businessModules.map((item) => {
                const Icon = item.icon
                return (
                  <section
                    key={item.module}
                    className='bg-card ring-foreground/10 flex flex-col gap-4 rounded-xl p-5 ring-1'
                  >
                    <div className='flex items-center gap-3'>
                      <Icon className='text-primary size-4' aria-hidden />
                      <h3 className='font-medium'>{item.module}</h3>
                    </div>
                    <div className='space-y-1'>
                      <p className='text-muted-foreground text-xs'>
                        {t('Capability')}
                      </p>
                      <p className='leading-6'>{item.capability}</p>
                    </div>
                    <div className='space-y-1'>
                      <p className='text-muted-foreground text-xs'>
                        {t('Customer value')}
                      </p>
                      <p className='leading-6'>{item.value}</p>
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        </section>

        <section className='px-6 py-12'>
          <div className='mx-auto max-w-6xl'>
            <h2 className='text-2xl font-semibold tracking-tight'>
              {t('How the platform works')}
            </h2>
            <ol className='mt-6 grid gap-3 md:grid-cols-3'>
              {platformLayers.map((layer, index) => (
                <li
                  key={layer}
                  className='bg-muted/40 rounded-xl border px-4 py-5'
                >
                  <p className='text-muted-foreground text-xs'>
                    {String(index + 1).padStart(2, '0')}
                  </p>
                  <p className='mt-2 font-medium'>{layer}</p>
                </li>
              ))}
            </ol>
            <p className='text-muted-foreground mt-6 max-w-3xl leading-7'>
              {t(
                'XTokenFactory follows the structure used by leading model aggregation platforms: a supply layer for models and compute, an intelligent routing layer, and an application layer for developers and enterprises. Upstream services are different models and inference backends. Downstream, customers use one API, the console, and application interfaces. Routing uses price, latency, throughput, availability, capability match, and data policy, and the platform keeps call data so model choice and resource allocation can keep improving.'
              )}
            </p>
          </div>
        </section>

        <section className='px-6 py-12'>
          <div className='mx-auto grid max-w-6xl gap-10 md:grid-cols-2'>
            <div>
              <h2 className='text-2xl font-semibold tracking-tight'>
                {t('Commercial path')}
              </h2>
              <p className='text-muted-foreground mt-4 leading-7'>
                {t(
                  'Billing follows usage. Base model calls are charged by tokens consumed or by the number of requests. The platform earns service fees, enterprise feature fees, and fees for extra services. Enterprise customers can add dedicated routing, budget and permission controls, data retention rules, regional deployment, a service level, and custom integration.'
                )}
              </p>
            </div>
            <div>
              <h2 className='text-2xl font-semibold tracking-tight'>
                {t('Our vision')}
              </h2>
              <p className='text-muted-foreground mt-4 leading-7'>
                {t(
                  'XTokenFactory aims to be the token factory and scheduling hub for AI applications: models that are easier to use, compute that moves more efficiently, and every call more stable, more transparent, and better value. By connecting model supply, infrastructure, and real business use, the company helps more teams turn large-model capability into products that can keep running.'
                )}
              </p>
            </div>
          </div>
        </section>

        <section className='px-6 py-12'>
          <div className='mx-auto max-w-6xl'>
            <h2 className='text-sm font-medium'>{t('Brand keywords')}</h2>
            <ul className='mt-4 flex flex-wrap gap-2'>
              {brandKeywords.map((keyword) => (
                <li
                  key={keyword}
                  className='bg-muted rounded-full border px-3 py-1 text-sm'
                >
                  {keyword}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {extraContent ? (
          <section className='px-6 py-12'>
            <div className='mx-auto max-w-6xl'>
              <RichContent
                mode={props.extraIsHtml ? 'html' : 'markdown'}
                htmlVariant={props.extraIsHtml ? 'isolated' : undefined}
                content={extraContent}
                className='prose-neutral dark:prose-invert max-w-none'
              />
            </div>
          </section>
        ) : null}

        <section className='px-6 py-12'>
          <div className='mx-auto max-w-6xl'>
            <ProjectAttribution />
          </div>
        </section>
      </article>
      <Footer />
    </PublicLayout>
  )
}
