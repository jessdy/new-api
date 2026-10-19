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
import { useQuery } from '@tanstack/react-query'
import { Headset } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { CONTACT_QUERY_KEY, getContact } from '@/lib/api'

function phoneLink(phone: string) {
  const digits = phone.replaceAll(/[^\d+]/g, '')
  if (!digits) return ''
  return `tel:${digits}`
}

function isSafeQrCode(value: string) {
  return (
    /^https?:\/\//i.test(value) ||
    /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(value)
  )
}

export function ContactButton() {
  const { t } = useTranslation()
  const contactQuery = useQuery({
    queryKey: CONTACT_QUERY_KEY,
    queryFn: getContact,
    staleTime: 5 * 60 * 1000,
  })
  const phone = contactQuery.data?.phone.trim() ?? ''
  const qrCode = contactQuery.data?.wechat_qrcode.trim() ?? ''
  const showQrCode = isSafeQrCode(qrCode)
  if (!phone && !showQrCode) {
    return null
  }

  const tel = phoneLink(phone)

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='outline'
            className='fixed top-1/2 right-0 z-40 h-auto -translate-y-1/2 flex-col gap-1 rounded-r-none px-2 py-3 shadow-md'
            aria-label={t('Contact')}
          />
        }
      >
        <Headset aria-hidden='true' />
        <span className='text-xs [writing-mode:vertical-rl]'>
          {t('Contact')}
        </span>
      </PopoverTrigger>
      <PopoverContent side='left' align='center' className='w-64'>
        <PopoverHeader>
          <PopoverTitle>{t('Contact')}</PopoverTitle>
        </PopoverHeader>
        {showQrCode ? (
          <div className='flex flex-col gap-2'>
            <p className='font-medium'>{t('WeChat')}</p>
            <img
              src={qrCode}
              alt={t('WeChat QR code')}
              className='bg-background mx-auto size-44 rounded-md border object-contain'
            />
          </div>
        ) : null}
        {phone ? (
          <div className='flex items-center justify-between gap-2'>
            <div className='min-w-0'>
              <p className='text-muted-foreground text-xs'>
                {t('Phone number')}
              </p>
              {tel ? (
                <a href={tel} className='font-medium break-all hover:underline'>
                  {phone}
                </a>
              ) : (
                <p className='font-medium break-all'>{phone}</p>
              )}
            </div>
            <CopyButton value={phone} />
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
