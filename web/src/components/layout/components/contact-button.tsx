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
import { Phone } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { IconWeChat } from '@/assets/brand-icons/icon-wechat'
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

const sideButtonClass =
  'size-11 rounded-full shadow-md [&_svg]:pointer-events-none [&_svg]:size-5'

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
  const tel = phoneLink(phone)

  return (
    <div className='fixed top-1/2 right-4 z-40 flex -translate-y-1/2 flex-col gap-3'>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type='button'
              size='icon-lg'
              className={`${sideButtonClass} bg-[#07C160] text-white hover:bg-[#06ad56]`}
              aria-label={t('WeChat')}
            />
          }
        >
          <IconWeChat aria-hidden='true' />
        </PopoverTrigger>
        <PopoverContent side='left' align='center' className='w-64'>
          <PopoverHeader>
            <PopoverTitle>{t('Dedicated pre-sales consultant')}</PopoverTitle>
          </PopoverHeader>
          {showQrCode ? (
            <img
              src={qrCode}
              alt={t('WeChat QR code')}
              className='bg-background mx-auto size-44 rounded-md border object-contain'
            />
          ) : (
            <p className='text-muted-foreground'>
              {t('No WeChat QR code has been set.')}
            </p>
          )}
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type='button'
              size='icon-lg'
              variant='outline'
              className={sideButtonClass}
              aria-label={t('Phone number')}
            />
          }
        >
          <Phone aria-hidden='true' />
        </PopoverTrigger>
        <PopoverContent side='left' align='center' className='w-64'>
          <PopoverHeader>
            <PopoverTitle>{t('Phone number')}</PopoverTitle>
          </PopoverHeader>
          {phone ? (
            <div className='flex items-center justify-between gap-2'>
              {tel ? (
                <a href={tel} className='font-medium break-all hover:underline'>
                  {phone}
                </a>
              ) : (
                <p className='font-medium break-all'>{phone}</p>
              )}
              <CopyButton value={phone} />
            </div>
          ) : (
            <p className='text-muted-foreground'>
              {t('No phone number has been set.')}
            </p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
