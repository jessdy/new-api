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
import { Check, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber, formatTokens } from '@/lib/format'
import { cn } from '@/lib/utils'

import { parseTags } from '../lib/filters'
import type { ModelCapability, PricingModel } from '../types'

const CAPABILITY_LABEL_KEYS: Record<ModelCapability, string> = {
  function_calling: 'Function calling',
  streaming: 'Streaming',
  vision: 'Vision',
  json_mode: 'JSON mode',
  structured_output: 'Structured output',
  reasoning: 'Reasoning',
  tools: 'Tools',
  system_prompt: 'System prompt',
  web_search: 'Web search',
  code_interpreter: 'Code interpreter',
  caching: 'Prompt caching',
  embeddings: 'Embeddings',
}

const MODALITY_LABEL_KEYS: Record<string, string> = {
  text: 'Text',
  image: 'Image',
  audio: 'Audio',
  video: 'Video',
  file: 'File',
}

export interface ModelAttributesHoverProps {
  model: PricingModel
}

export function ModelAttributesHover(props: ModelAttributesHoverProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const endpoints = props.model.supported_endpoint_types ?? []
  const groups = props.model.enable_groups ?? []
  const tags = parseTags(props.model.tags)
  const capabilities = props.model.capabilities ?? []
  const inputModalities = props.model.input_modalities ?? []
  const outputModalities = props.model.output_modalities ?? []
  const contextLength = props.model.context_length ?? 0
  const maxOutput = props.model.max_output_tokens ?? 0
  const hasLimits = contextLength > 0 || maxOutput > 0
  const hasModalities =
    inputModalities.length > 0 || outputModalities.length > 0
  const hasBody =
    endpoints.length > 0 ||
    hasLimits ||
    hasModalities ||
    capabilities.length > 0 ||
    groups.length > 0 ||
    tags.length > 0 ||
    Boolean(props.model.description) ||
    Boolean(props.model.vendor_name)

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={120}
        closeDelay={80}
        render={
          <button
            type='button'
            data-testid='model-attributes-trigger'
            aria-label={t('View attributes')}
            className='text-muted-foreground hover:text-foreground inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-colors'
            onClick={(event) => event.stopPropagation()}
          />
        }
      >
        <Info aria-hidden className='size-3.5' strokeWidth={1.75} />
      </HoverCardTrigger>
      <HoverCardContent
        side='top'
        align='start'
        sideOffset={8}
        className='bg-zinc-950 text-zinc-100 ring-zinc-800 w-80 max-w-[min(20rem,calc(100vw-2rem))] border-0 p-0 shadow-xl ring-1 dark:bg-zinc-950'
      >
        <div className='max-h-[min(24rem,calc(100vh-2rem))] space-y-3 overflow-y-auto p-3 text-xs leading-relaxed'>
          {!hasBody ? (
            <p className='text-zinc-400'>
              {t('No description available.')}
            </p>
          ) : null}

          {props.model.description ? (
            <p className='text-zinc-300 text-[13px] leading-5'>
              {props.model.description}
            </p>
          ) : null}

          {endpoints.length > 0 ? (
            <div data-testid='model-protocols'>
              <p className='text-zinc-400'>{t('Protocols')}</p>
              <ul className='mt-2 flex flex-wrap gap-1.5'>
                {endpoints.map((endpoint) => (
                  <li
                    key={endpoint}
                    className='inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-zinc-50 ring-1 ring-emerald-400/50 ring-inset'
                    title={endpoint}
                  >
                    <Check aria-hidden className='size-3 shrink-0' />
                    <span className='max-w-36 truncate'>{endpoint}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {hasLimits ? (
            <dl className='grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5'>
              {contextLength > 0 ? (
                <>
                  <dt className='text-zinc-400'>{t('Context length')}</dt>
                  <dd className='text-right font-medium tabular-nums'>
                    {formatNumber(contextLength, locale)}
                  </dd>
                </>
              ) : null}
              {maxOutput > 0 ? (
                <>
                  <dt className='text-zinc-400'>{t('Max output')}</dt>
                  <dd className='text-right font-medium tabular-nums'>
                    {formatTokens(maxOutput)}
                  </dd>
                </>
              ) : null}
            </dl>
          ) : null}

          {hasModalities ? (
            <div>
              <p className='text-zinc-400'>{t('Modalities')}</p>
              <div className='mt-2 flex flex-wrap gap-1.5'>
                {[...inputModalities, ...outputModalities]
                  .filter(
                    (item, index, list) => list.indexOf(item) === index
                  )
                  .map((modality) => (
                    <span
                      key={modality}
                      className='rounded-md bg-white/5 px-1.5 py-0.5 text-zinc-100'
                    >
                      {t(MODALITY_LABEL_KEYS[modality] ?? modality)}
                    </span>
                  ))}
              </div>
            </div>
          ) : null}

          {capabilities.length > 0 ? (
            <div>
              <p className='text-zinc-400'>{t('Features')}</p>
              <ul className='mt-2 flex flex-wrap gap-1.5'>
                {capabilities.map((capability) => (
                  <li
                    key={capability}
                    className='inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 text-zinc-100'
                  >
                    <Check
                      aria-hidden
                      className='size-3 shrink-0 text-emerald-400'
                    />
                    {t(
                      CAPABILITY_LABEL_KEYS[capability as ModelCapability] ??
                        capability
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {groups.length > 0 ? (
            <div role='group' aria-label={t('Groups')}>
              <p className='text-zinc-400'>{t('Groups')}</p>
              <p className='mt-1 text-zinc-100' title={groups.join(', ')}>
                {groups.join(', ')}
              </p>
            </div>
          ) : null}

          {tags.length > 0 ? (
            <div role='group' aria-label={t('Tags')}>
              <p className='text-zinc-400'>{t('Tags')}</p>
              <p className='mt-1 text-zinc-100' title={tags.join(', ')}>
                {tags.join(', ')}
              </p>
            </div>
          ) : null}

          {props.model.vendor_name ? (
            <p className='text-zinc-500'>
              {t('Provider')}: {props.model.vendor_name}
            </p>
          ) : null}

          <p
            className={cn(
              'text-amber-200/80 border-t border-white/10 pt-2 text-[11px] leading-4'
            )}
          >
            {t(
              'Attributes may differ by route; limits show the known maximum when available.'
            )}
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
