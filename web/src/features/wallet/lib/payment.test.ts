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
import { afterEach, describe, expect, test, vi } from 'vitest'

import { PAYMENT_TYPES } from '../constants'
import {
  dispatchSelectedPayment,
  isAlipayNativePayment,
  isStripePayment,
  isWaffoPayment,
  isWaffoPancakePayment,
  submitPaymentForm,
} from './payment'

describe('payment type classification', () => {
  test('keeps Waffo and Waffo Pancake on their dedicated flows', () => {
    expect(isWaffoPayment(PAYMENT_TYPES.WAFFO)).toBe(true)
    expect(isWaffoPayment(PAYMENT_TYPES.WAFFO_PANCAKE)).toBe(false)
    expect(isWaffoPancakePayment(PAYMENT_TYPES.WAFFO_PANCAKE)).toBe(true)
    expect(isWaffoPancakePayment(PAYMENT_TYPES.WAFFO)).toBe(false)
    expect(isStripePayment(PAYMENT_TYPES.STRIPE)).toBe(true)
    expect(isAlipayNativePayment(PAYMENT_TYPES.ALIPAY_NATIVE)).toBe(true)
    expect(isAlipayNativePayment(PAYMENT_TYPES.ALIPAY)).toBe(false)
  })
})

describe('payment dispatch', () => {
  test('keeps the selected Waffo method index through confirmation', async () => {
    const calls: string[] = []
    const success = await dispatchSelectedPayment(
      { name: 'Waffo Card', type: PAYMENT_TYPES.WAFFO },
      120,
      3,
      {
        regular: async () => {
          calls.push('regular')
          return false
        },
        waffo: async (amount, index) => {
          calls.push(`waffo:${amount}:${index}`)
          return true
        },
        waffoPancake: async () => {
          calls.push('pancake')
          return false
        },
      }
    )

    expect(success).toBe(true)
    expect(calls).toEqual(['waffo:120:3'])
  })

  test('does not create a Waffo order without a selected method index', async () => {
    let called = false
    const success = await dispatchSelectedPayment(
      { name: 'Waffo Card', type: PAYMENT_TYPES.WAFFO },
      120,
      null,
      {
        regular: async () => false,
        waffo: async () => {
          called = true
          return true
        },
        waffoPancake: async () => false,
      }
    )

    expect(success).toBe(false)
    expect(called).toBe(false)
  })
})

describe('submitPaymentForm', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.replaceChildren()
  })

  test('posts Alipay params without letting the method field override HTTP POST', () => {
    vi.useFakeTimers()
    vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => undefined)

    submitPaymentForm('https://openapi.alipay.com/gateway.do?charset=utf-8', {
      method: 'alipay.trade.page.pay',
      app_id: '2021007105612217',
      charset: 'utf-8',
    })

    const form = document.querySelector('form')
    expect(form).toBeInstanceOf(HTMLFormElement)
    expect(form?.getAttribute('method')).toBe('post')
    expect(form?.getAttribute('action')).toBe(
      'https://openapi.alipay.com/gateway.do?charset=utf-8'
    )
    const methodField = form?.querySelector('input[name="method"]')
    expect(methodField).toBeInstanceOf(HTMLInputElement)
    expect((methodField as HTMLInputElement).value).toBe(
      'alipay.trade.page.pay'
    )
    expect(form && document.body.contains(form)).toBe(true)

    vi.advanceTimersByTime(2000)
    expect(form && document.body.contains(form)).toBe(false)
  })
})
