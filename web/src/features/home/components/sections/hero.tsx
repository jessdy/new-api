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
import { CherryStudio } from '@lobehub/icons'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, ArrowUp, Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { HeaderLogo } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { useSystemConfig } from '@/hooks/use-system-config'

import { HeroTerminalDemo } from '../hero-terminal-demo'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

const MODEL_CLOUD = [
  { label: 'OpenAI', className: 'top-[8%] left-[3%] text-4xl md:text-6xl' },
  { label: 'Claude', className: 'top-[12%] right-[4%] text-3xl md:text-5xl' },
  { label: 'Gemini', className: 'top-[38%] left-[2%] text-2xl md:text-4xl' },
  { label: 'DeepSeek', className: 'top-[52%] right-[3%] text-3xl md:text-5xl' },
  { label: 'Qwen', className: 'bottom-[28%] left-[6%] text-2xl md:text-4xl' },
  { label: 'Kimi', className: 'bottom-[18%] right-[10%] text-xl md:text-3xl' },
  { label: 'GLM', className: 'top-[68%] left-[42%] text-xl md:text-3xl' },
  {
    label: 'Anthropic',
    className: 'top-[26%] left-[38%] text-lg md:text-2xl tracking-wide',
  },
]

const PROMPT_SUGGESTIONS = [
  'Write a short product launch announcement',
  'Explain how API gateway routing works',
  'Compare Claude and GPT for coding agents',
] as const

const MoreIcon = () => (
  <svg
    className='text-muted-foreground/60 group-hover:text-foreground size-6 shrink-0 transition-colors'
    viewBox='0 0 24 24'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
  >
    <circle cx='6' cy='12' r='2' fill='currentColor' />
    <circle cx='12' cy='12' r='2' fill='currentColor' />
    <circle cx='18' cy='12' r='2' fill='currentColor' />
  </svg>
)

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { logo, loading, logoLoaded } = useSystemConfig()
  const [prompt, setPrompt] = useState('')

  const goPrimary = () => {
    if (props.isAuthenticated) {
      void navigate({ to: '/dashboard' })
      return
    }
    void navigate({ to: '/sign-up' })
  }

  const onPromptSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (props.isAuthenticated) {
      void navigate({ to: '/playground' })
      return
    }
    goPrimary()
  }

  return (
    <section className='relative z-10 overflow-hidden px-6 pt-24 pb-12 md:pt-28 md:pb-16'>
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10'
        style={{
          background: [
            'radial-gradient(ellipse 55% 42% at 50% 0%, oklch(0.69 0.15 280 / 22%) 0%, transparent 55%)',
            'radial-gradient(ellipse 32% 48% at 0% 35%, oklch(0.69 0.15 280 / 12%) 0%, transparent 70%)',
            'radial-gradient(ellipse 32% 48% at 100% 35%, oklch(0.78 0.12 192 / 14%) 0%, transparent 70%)',
          ].join(', '),
        }}
      />

      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none'
      >
        {MODEL_CLOUD.map((item) => (
          <span
            key={item.label}
            className={`text-foreground absolute font-bold tracking-tight opacity-[0.05] dark:opacity-[0.1] ${item.className}`}
          >
            {item.label}
          </span>
        ))}
      </div>

      <div className='mx-auto flex max-w-4xl flex-col items-center text-center'>
        <div
          className='landing-animate-fade-up mb-6 flex flex-wrap items-center justify-center gap-2 opacity-0'
          style={{ animationDelay: '0ms' }}
        >
          <div className='border-brand-from/25 bg-brand-from/10 text-brand-from dark:border-brand-from/30 dark:bg-brand-from/15 dark:text-brand-to inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-medium'>
            <span className='relative flex size-1.5'>
              <span className='bg-brand-to absolute inline-flex h-full w-full animate-ping rounded-full opacity-75' />
              <span className='bg-brand-from relative inline-flex size-1.5 rounded-full' />
            </span>
            <span>{t('AI Application Infrastructure Foundation')}</span>
          </div>
        </div>

        <h1
          className='landing-animate-fade-up text-[clamp(2.4rem,5.5vw,3.9rem)] leading-[1.08] font-bold tracking-tight'
          style={{ animationDelay: '60ms' }}
        >
          <span className='inline-flex items-center justify-center gap-3'>
            <span className='flex size-10 shrink-0 items-center justify-center sm:size-12'>
              <HeaderLogo
                src={logo}
                alt={t('Logo')}
                loading={loading}
                logoLoaded={logoLoaded}
                className='size-full rounded-lg object-contain'
              />
            </span>
            <span>{t('Unified API Gateway for')}</span>
          </span>
          <span className='from-brand-from to-brand-to mt-2 block bg-gradient-to-r bg-clip-text text-transparent'>
            {t('Vast Range of AI Models')}
          </span>
        </h1>

        <p
          className='landing-animate-fade-up text-muted-foreground mt-5 max-w-xl text-base leading-relaxed opacity-0 md:text-[15px]'
          style={{ animationDelay: '120ms' }}
        >
          {t(
            'Model access, intelligent routing, and token scheduling for AI applications'
          )}
        </p>

        <div
          className='landing-animate-fade-up mt-8 flex flex-wrap items-center justify-center gap-3 opacity-0'
          style={{ animationDelay: '160ms' }}
        >
          {props.isAuthenticated ? (
            <Button
              className='group h-12 rounded-md px-8 text-sm font-semibold'
              render={<Link to='/dashboard' />}
            >
              {t('Go to Dashboard')}
              <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
            </Button>
          ) : (
            <>
              <Button
                className='group h-12 rounded-md px-8 text-sm font-semibold'
                render={<Link to='/sign-up' />}
              >
                {t('Get Started')}
                <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
              </Button>
              <Button
                variant='ghost'
                className='text-brand-from hover:text-brand-to h-12 rounded-md px-4 text-sm font-medium'
                render={<Link to='/pricing' />}
              >
                {t('View Pricing')}
              </Button>
            </>
          )}
        </div>

        <ul
          className='landing-animate-fade-up text-muted-foreground mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs opacity-0 md:text-[13px]'
          style={{ animationDelay: '200ms' }}
        >
          <li className='flex items-center gap-2'>
            <span className='bg-brand-from size-1.5 rounded-full' />
            {t('Multi-protocol Compatible')}
          </li>
          <li className='flex items-center gap-2'>
            <span className='size-1.5 rounded-full bg-[color-mix(in_oklch,var(--brand-from)_50%,var(--brand-to))]' />
            {t('Transparent Billing')}
          </li>
          <li className='flex items-center gap-2'>
            <span className='bg-brand-to size-1.5 rounded-full' />
            {t('Secure & Reliable')}
          </li>
        </ul>

        <form
          onSubmit={onPromptSubmit}
          className='landing-animate-fade-up border-border/50 bg-card/60 mt-10 w-full max-w-2xl rounded-lg border p-2 shadow-sm backdrop-blur-md opacity-0'
          style={{ animationDelay: '240ms' }}
        >
          <div className='flex items-center gap-2'>
            <Search className='text-muted-foreground ml-2 size-4 shrink-0' />
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('What do you want to do?')}
              className='placeholder:text-muted-foreground/55 h-11 min-w-0 flex-1 bg-transparent text-sm outline-none'
              aria-label={t('What do you want to do?')}
            />
            <Button
              type='submit'
              size='icon'
              className='size-10 shrink-0 rounded-lg'
              aria-label={t('Get Started')}
            >
              <ArrowUp className='size-4' />
            </Button>
          </div>
        </form>

        <div
          className='landing-animate-fade-up mt-4 flex flex-wrap items-center justify-center gap-2 opacity-0'
          style={{ animationDelay: '280ms' }}
        >
          {PROMPT_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type='button'
              onClick={() => setPrompt(t(suggestion))}
              className='bg-muted/40 text-muted-foreground hover:bg-brand-from/10 hover:text-foreground rounded-md px-3.5 py-1.5 text-xs transition-colors'
            >
              {t(suggestion)}
            </button>
          ))}
        </div>

        <div
          className='landing-animate-fade-up mt-10 w-full max-w-2xl opacity-0'
          style={{ animationDelay: '320ms' }}
        >
          <div className='mb-4 flex flex-col items-center gap-1'>
            <span className='text-muted-foreground/50 text-[10px] font-bold tracking-[0.15em] uppercase'>
              {t('Supported Applications')}
            </span>
            <p className='text-muted-foreground/60 max-w-md text-xs leading-relaxed'>
              {t(
                'Supports one-click configuration and perfectly adapts to NewAPI multi-protocol configuration.'
              )}
            </p>
          </div>
          <div className='flex flex-wrap items-center justify-center gap-3'>
            <a
              href='https://cherry-ai.com'
              target='_blank'
              rel='noopener noreferrer'
              className='group bg-muted/40 text-foreground/80 hover:bg-muted/70 hover:text-foreground flex items-center gap-3 rounded-md px-5 py-2.5 text-sm font-medium transition-all duration-300 hover:scale-[1.02]'
            >
              <CherryStudio.Color size={24} className='shrink-0' />
              <span>Cherry Studio</span>
            </a>

            <a
              href='https://ccswitch.io'
              target='_blank'
              rel='noopener noreferrer'
              className='group bg-muted/40 text-foreground/80 hover:bg-muted/70 hover:text-foreground flex items-center gap-3 rounded-md px-5 py-2.5 text-sm font-medium transition-all duration-300 hover:scale-[1.02]'
            >
              <img
                src='https://ccswitch.io/favicon.png'
                alt='CC Switch'
                className='size-6 shrink-0 rounded-md object-contain'
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const fallback = e.currentTarget.nextSibling as HTMLElement
                  if (fallback) fallback.style.display = 'flex'
                }}
              />
              <span
                style={{ display: 'none' }}
                className='bg-brand-from/10 text-brand-from dark:bg-brand-from/15 dark:text-brand-to size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold'
              >
                CC
              </span>
              <span>CC Switch</span>
            </a>

            <div className='group bg-muted/40 text-foreground/55 hover:bg-muted/70 hover:text-foreground flex cursor-default items-center gap-2.5 rounded-md px-5 py-2.5 text-sm font-medium transition-all duration-300 hover:scale-[1.02]'>
              <MoreIcon />
              <span>{t('More Apps')}</span>
            </div>
          </div>
        </div>
      </div>

      <div
        className='landing-animate-fade-up mx-auto mt-12 flex w-full max-w-6xl justify-center opacity-0 md:mt-16'
        style={{ animationDelay: '360ms' }}
      >
        <div className='border-border/40 bg-card/30 w-full overflow-hidden rounded-lg border p-2 shadow-[0_20px_60px_-28px_rgba(0,0,0,0.35)] backdrop-blur-sm md:p-3'>
          <HeroTerminalDemo className='mx-auto w-full max-w-none' />
        </div>
      </div>
    </section>
  )
}
