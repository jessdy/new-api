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
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const contactSchema = z.object({
  ContactPhone: z.string(),
  ContactWeChatQRCode: z.string(),
})

type ContactFormValues = z.infer<typeof contactSchema>

const qrImageTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

type ContactSectionProps = {
  defaultPhone: string
  defaultQRCode: string
}

function isPhoneNumber(value: string) {
  const phone = value.trim()
  if (phone.length === 0) {
    return true
  }
  if ([...phone].length > 40) {
    return false
  }
  if (!/^[0-9+\-() ]+$/.test(phone)) {
    return false
  }
  return /\d/.test(phone)
}

function isQrCode(value: string) {
  const qrCode = value.trim()
  if (qrCode.length === 0) {
    return true
  }
  if (qrCode.length > 1_500_000) {
    return false
  }
  if (/^https?:\/\//i.test(qrCode)) {
    try {
      const url = new URL(qrCode)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  }
  return /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(
    qrCode
  )
}

async function readQrFile(file: File) {
  if (!qrImageTypes.has(file.type) || file.size > 8 * 1024 * 1024) {
    throw new Error(qrImageTypes.has(file.type) ? 'size' : 'type')
  }
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('type')
    }
    context.drawImage(bitmap, 0, 0, width, height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    if (dataUrl.length > 1_400_000) {
      throw new Error('size')
    }
    return dataUrl
  } finally {
    bitmap.close()
  }
}

export function ContactSection(props: ContactSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      ContactPhone: props.defaultPhone ?? '',
      ContactWeChatQRCode: props.defaultQRCode ?? '',
    },
  })

  useEffect(() => {
    form.reset({
      ContactPhone: props.defaultPhone ?? '',
      ContactWeChatQRCode: props.defaultQRCode ?? '',
    })
  }, [form, props.defaultPhone, props.defaultQRCode])

  const onSubmit = async (values: ContactFormValues) => {
    form.clearErrors()
    const phone = values.ContactPhone.trim()
    const qrCode = values.ContactWeChatQRCode.trim()
    if (!isPhoneNumber(phone)) {
      form.setError('ContactPhone', {
        message: t(
          'Enter a phone number using digits, spaces, plus, and hyphens.'
        ),
      })
      return
    }
    if (!isQrCode(qrCode)) {
      form.setError('ContactWeChatQRCode', {
        message: t('Only PNG, JPEG, WEBP, and GIF images are supported.'),
      })
      return
    }

    const previousPhone = (props.defaultPhone ?? '').trim()
    const previousQRCode = (props.defaultQRCode ?? '').trim()
    if (phone !== previousPhone) {
      await updateOption.mutateAsync({ key: 'ContactPhone', value: phone })
    }
    if (qrCode !== previousQRCode) {
      await updateOption.mutateAsync({
        key: 'ContactWeChatQRCode',
        value: qrCode,
      })
    }
  }

  return (
    <SettingsSection title={t('Contact')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel='Save contact details'
          />
          <FormField
            control={form.control}
            name='ContactPhone'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Phone number')}</FormLabel>
                <FormControl>
                  <Input
                    inputMode='tel'
                    autoComplete='tel'
                    placeholder='400-000-0000'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='ContactWeChatQRCode'
            render={({ field }) => {
              const qrCode = field.value ?? ''
              const imageURL = qrCode.startsWith('data:') ? '' : qrCode
              return (
                <FormItem>
                  <FormLabel>{t('WeChat QR code')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Paste an image URL or upload a PNG, JPEG, WEBP, or GIF.'
                    )}
                  </FormDescription>
                  {isQrCode(qrCode) && qrCode.trim() !== '' ? (
                    <img
                      src={qrCode}
                      alt={t('WeChat QR code')}
                      className='bg-background size-40 rounded-md border object-contain'
                    />
                  ) : null}
                  <FormControl>
                    <Input
                      value={imageURL}
                      placeholder={t('Image URL')}
                      onChange={(event) => field.onChange(event.target.value)}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <div className='flex flex-wrap gap-2'>
                    <input
                      ref={fileInputRef}
                      type='file'
                      accept='image/png,image/jpeg,image/webp,image/gif'
                      className='sr-only'
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ''
                        if (!file) return
                        void readQrFile(file)
                          .then((dataUrl) => {
                            field.onChange(dataUrl)
                          })
                          .catch((error: unknown) => {
                            const reason =
                              error instanceof Error ? error.message : 'type'
                            if (reason === 'size') {
                              toast.error(t('Choose an image under 2 MB.'))
                              return
                            }
                            toast.error(
                              t(
                                'Only PNG, JPEG, WEBP, and GIF images are supported.'
                              )
                            )
                          })
                      }}
                    />
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {t('Upload')}
                    </Button>
                    {qrCode.trim() !== '' ? (
                      <Button
                        type='button'
                        variant='ghost'
                        onClick={() => field.onChange('')}
                      >
                        {t('Remove image')}
                      </Button>
                    ) : null}
                  </div>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
