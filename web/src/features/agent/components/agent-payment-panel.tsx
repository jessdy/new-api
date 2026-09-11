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
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AmountDiscountVisualEditor } from '@/features/system-settings/integrations/amount-discount-visual-editor'
import { AmountOptionsVisualEditor } from '@/features/system-settings/integrations/amount-options-visual-editor'
import { PaymentMethodsVisualEditor } from '@/features/system-settings/integrations/payment-methods-visual-editor'
import { handleServerError } from '@/lib/handle-server-error'

import {
  getAgentPaymentConfig,
  getAgentSelf,
  updateAgentPaymentConfig,
  type AgentPaymentConfigView,
} from '../api'

type AgentPaymentPanelProps = {
  agentId?: number
}

function discountToJson(discount: Record<string, number> | undefined) {
  return JSON.stringify(discount ?? {}, null, 2)
}

function optionsToJson(options: number[] | undefined) {
  return JSON.stringify(options ?? [], null, 2)
}

function methodsToJson(
  methods: Array<Record<string, string>> | undefined
) {
  return JSON.stringify(methods ?? [], null, 2)
}

function parseDiscount(raw: string): Record<number, number> {
  try {
    const parsed = JSON.parse(raw) as Record<string, number>
    const result: Record<number, number> = {}
    for (const [key, value] of Object.entries(parsed ?? {})) {
      const amount = Number(key)
      if (Number.isFinite(amount) && typeof value === 'number' && value > 0) {
        result[amount] = value
      }
    }
    return result
  } catch {
    return {}
  }
}

function parseOptions(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(Number)
      .filter((value) => Number.isFinite(value) && value > 0)
  } catch {
    return []
  }
}

function parseMethods(raw: string): Array<Record<string, string>> {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is Record<string, string> =>
        Boolean(item) && typeof item === 'object' && !Array.isArray(item)
    )
  } catch {
    return []
  }
}

export function AgentPaymentPanel(props: AgentPaymentPanelProps) {
  const { t } = useTranslation()
  const paymentQuery = useQuery({
    queryKey: ['agent', 'payment', props.agentId],
    queryFn: () => getAgentPaymentConfig(props.agentId),
  })
  const selfQuery = useQuery({
    queryKey: ['agent', 'self', props.agentId],
    queryFn: () => getAgentSelf(props.agentId),
  })

  const [price, setPrice] = useState('1')
  const [minTopUp, setMinTopUp] = useState('1')
  const [amountOptions, setAmountOptions] = useState('[]')
  const [amountDiscount, setAmountDiscount] = useState('{}')
  const [epayEnabled, setEpayEnabled] = useState(false)
  const [payAddress, setPayAddress] = useState('')
  const [customCallback, setCustomCallback] = useState('')
  const [epayId, setEpayId] = useState('')
  const [epayKey, setEpayKey] = useState('')
  const [payMethods, setPayMethods] = useState('[]')
  const [stripeEnabled, setStripeEnabled] = useState(false)
  const [stripeSecret, setStripeSecret] = useState('')
  const [stripeWebhook, setStripeWebhook] = useState('')
  const [stripePriceId, setStripePriceId] = useState('')
  const [stripeUnitPrice, setStripeUnitPrice] = useState('1')
  const [stripeMinTopUp, setStripeMinTopUp] = useState('1')
  const [stripePromo, setStripePromo] = useState(false)

  useEffect(() => {
    const data = paymentQuery.data
    if (!data) return
    hydrateForm(data)
  }, [paymentQuery.data])

  function hydrateForm(data: AgentPaymentConfigView) {
    setPrice(String(data.price || 1))
    setMinTopUp(String(data.min_topup || 1))
    setAmountOptions(optionsToJson(data.amount_options))
    setAmountDiscount(discountToJson(data.amount_discount))
    setEpayEnabled(Boolean(data.epay_enabled))
    setPayAddress(data.pay_address || '')
    setCustomCallback(data.custom_callback_address || '')
    setEpayId('')
    setEpayKey('')
    setPayMethods(methodsToJson(data.pay_methods))
    setStripeEnabled(Boolean(data.stripe_enabled))
    setStripeSecret('')
    setStripeWebhook('')
    setStripePriceId(data.stripe_price_id || '')
    setStripeUnitPrice(String(data.stripe_unit_price || 1))
    setStripeMinTopUp(String(data.stripe_min_topup || 1))
    setStripePromo(Boolean(data.stripe_promotion_codes_enabled))
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      updateAgentPaymentConfig(
        {
          price: Number(price) || 0,
          min_topup: Number(minTopUp) || 0,
          amount_options: parseOptions(amountOptions),
          amount_discount: parseDiscount(amountDiscount),
          epay_enabled: epayEnabled,
          pay_address: payAddress.trim(),
          custom_callback_address: customCallback.trim(),
          ...(epayId.trim() ? { epay_id: epayId.trim() } : {}),
          ...(epayKey.trim() ? { epay_key: epayKey.trim() } : {}),
          pay_methods: parseMethods(payMethods),
          stripe_enabled: stripeEnabled,
          ...(stripeSecret.trim()
            ? { stripe_api_secret: stripeSecret.trim() }
            : {}),
          ...(stripeWebhook.trim()
            ? { stripe_webhook_secret: stripeWebhook.trim() }
            : {}),
          stripe_price_id: stripePriceId.trim(),
          stripe_unit_price: Number(stripeUnitPrice) || 0,
          stripe_min_topup: Number(stripeMinTopUp) || 0,
          stripe_promotion_codes_enabled: stripePromo,
        },
        props.agentId
      ),
    onSuccess: (data) => {
      toast.success(t('Payment settings saved'))
      hydrateForm(data)
      void paymentQuery.refetch()
    },
    onError: (error) => handleServerError(error),
  })

  const webhookAgentId = selfQuery.data?.id ?? props.agentId
  const stripeWebhookUrl = webhookAgentId
    ? `${window.location.origin}/api/stripe/webhook/${webhookAgentId}`
    : `${window.location.origin}/api/stripe/webhook/{agent_id}`

  return (
    <div className='space-y-4'>
      <div className='text-muted-foreground text-sm'>
        {t(
          'Configure your own payment gateway. Users under this agent pay through these settings, not the platform gateway.'
        )}
      </div>

      <Tabs defaultValue='general'>
        <TabsList>
          <TabsTrigger value='general'>{t('General')}</TabsTrigger>
          <TabsTrigger value='epay'>{t('Epay')}</TabsTrigger>
          <TabsTrigger value='stripe'>{t('Stripe')}</TabsTrigger>
        </TabsList>

        <TabsContent value='general' className='mt-4 space-y-4'>
          <div className='grid max-w-xl gap-3'>
            <Label>{t('Unit price')}</Label>
            <Input
              type='number'
              min={0}
              step='0.01'
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <Label>{t('Minimum top-up')}</Label>
            <Input
              type='number'
              min={0}
              value={minTopUp}
              onChange={(e) => setMinTopUp(e.target.value)}
            />
          </div>
          <div className='space-y-2'>
            <Label>{t('Amount options')}</Label>
            <AmountOptionsVisualEditor
              value={amountOptions}
              onChange={setAmountOptions}
            />
          </div>
          <div className='space-y-2'>
            <Label>{t('Amount discounts')}</Label>
            <AmountDiscountVisualEditor
              value={amountDiscount}
              onChange={setAmountDiscount}
            />
          </div>
        </TabsContent>

        <TabsContent value='epay' className='mt-4 space-y-4'>
          <div className='flex items-center justify-between rounded-md border p-3'>
            <div>
              <div className='font-medium'>{t('Enable Epay')}</div>
              <div className='text-muted-foreground text-sm'>
                {t('Accept payments through your own Epay merchant account.')}
              </div>
            </div>
            <Switch checked={epayEnabled} onCheckedChange={setEpayEnabled} />
          </div>
          <div className='grid max-w-xl gap-3'>
            <Label>{t('Pay address')}</Label>
            <Input
              value={payAddress}
              onChange={(e) => setPayAddress(e.target.value)}
              placeholder='https://pay.example.com'
            />
            <Label>{t('Custom callback address')}</Label>
            <Input
              value={customCallback}
              onChange={(e) => setCustomCallback(e.target.value)}
              placeholder='https://api.example.com'
            />
            <Label>{t('Epay ID')}</Label>
            <Input
              value={epayId}
              onChange={(e) => setEpayId(e.target.value)}
              placeholder={
                paymentQuery.data?.epay_id_set
                  ? t('Leave empty to keep current ID')
                  : t('Merchant ID')
              }
              autoComplete='off'
            />
            <Label>{t('Epay key')}</Label>
            <Input
              type='password'
              value={epayKey}
              onChange={(e) => setEpayKey(e.target.value)}
              placeholder={
                paymentQuery.data?.epay_key_set
                  ? t('Leave empty to keep current key')
                  : t('Merchant key')
              }
              autoComplete='new-password'
            />
          </div>
          <div className='space-y-2'>
            <Label>{t('Payment methods')}</Label>
            <PaymentMethodsVisualEditor
              value={payMethods}
              onChange={setPayMethods}
            />
          </div>
        </TabsContent>

        <TabsContent value='stripe' className='mt-4 space-y-4'>
          <div className='flex items-center justify-between rounded-md border p-3'>
            <div>
              <div className='font-medium'>{t('Enable Stripe')}</div>
              <div className='text-muted-foreground text-sm'>
                {t('Accept payments through your own Stripe account.')}
              </div>
            </div>
            <Switch
              checked={stripeEnabled}
              onCheckedChange={setStripeEnabled}
            />
          </div>
          <div className='grid max-w-xl gap-3'>
            <Label>{t('Stripe API secret')}</Label>
            <Input
              type='password'
              value={stripeSecret}
              onChange={(e) => setStripeSecret(e.target.value)}
              placeholder={
                paymentQuery.data?.stripe_api_secret_set
                  ? t('Leave empty to keep current secret')
                  : 'sk_live_...'
              }
              autoComplete='new-password'
            />
            <Label>{t('Stripe webhook secret')}</Label>
            <Input
              type='password'
              value={stripeWebhook}
              onChange={(e) => setStripeWebhook(e.target.value)}
              placeholder={
                paymentQuery.data?.stripe_webhook_secret_set
                  ? t('Leave empty to keep current secret')
                  : 'whsec_...'
              }
              autoComplete='new-password'
            />
            <Label>{t('Stripe webhook URL')}</Label>
            <Input readOnly value={stripeWebhookUrl} />
            <p className='text-muted-foreground text-xs'>
              {t(
                'Configure this URL in your Stripe Dashboard webhook endpoint.'
              )}
            </p>
            <Label>{t('Stripe price ID')}</Label>
            <Input
              value={stripePriceId}
              onChange={(e) => setStripePriceId(e.target.value)}
              placeholder='price_...'
            />
            <Label>{t('Stripe unit price')}</Label>
            <Input
              type='number'
              min={0}
              step='0.01'
              value={stripeUnitPrice}
              onChange={(e) => setStripeUnitPrice(e.target.value)}
            />
            <Label>{t('Stripe minimum top-up')}</Label>
            <Input
              type='number'
              min={0}
              value={stripeMinTopUp}
              onChange={(e) => setStripeMinTopUp(e.target.value)}
            />
            <div className='flex items-center justify-between rounded-md border p-3'>
              <div>
                <div className='font-medium'>
                  {t('Allow promotion codes')}
                </div>
                <div className='text-muted-foreground text-sm'>
                  {t('Enable Stripe checkout promotion codes.')}
                </div>
              </div>
              <Switch checked={stripePromo} onCheckedChange={setStripePromo} />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending || paymentQuery.isLoading}
      >
        {t('Save payment settings')}
      </Button>
    </div>
  )
}
