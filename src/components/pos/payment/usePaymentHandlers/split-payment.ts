'use client'

import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { type OrderForPayment, type PaymentExecContext } from './types'

// ============================================
// SPLIT PLAČILO
// ============================================

// P0 FIX: Deterministični idempotencyKey za vsako split plačilo.
// Ključ vključi checkId + splitIndex + znesek, tako da:
//   - retry po napaki (ista konfiguracija) dobi isti ključ → idempotent
//   - različni split-i (index 0, 1, 2...) imajo različne ključe → ni kolizije,
//     tudi če imata enak znesek (npr. 2x €10)
function makeSplitPaymentKey(checkId: string, splitIndex: number, amount: number): string {
  return `split-${checkId}-s${splitIndex}-${amount.toFixed(2)}`
}

export async function executeSplitPayment({
  order,
  orderTotal,
  tipAmount,
  splitCount,
  paymentMethod,
  queryClient,
  onPaymentSuccess,
  resetAndClose,
}: {
  order: OrderForPayment
  orderTotal: number
  tipAmount: number
  splitCount: number
  paymentMethod: string
} & PaymentExecContext) {
  // FIX BUG-04: Prepreči podvojene čeke — ponovno uporabi obstoječi neplačani ček
  let splitCheckId: string | undefined
  const existingSplitChecksRes = await authFetch(`/api/checks?orderId=${order.id}&paymentStatus=unpaid`)
  if (existingSplitChecksRes.ok) {
    const checksData = await existingSplitChecksRes.json()
    const unpaidCheck = checksData.checks?.find((c: { paymentStatus: string }) => c.paymentStatus === 'unpaid')
    if (unpaidCheck) {
      splitCheckId = unpaidCheck.id
    }
  }
  if (!splitCheckId) {
    const checkRes = await authFetch('/api/checks', {
      method: 'POST',
      body: JSON.stringify({
        orderId: order.id,
        orderItemIds: order.orderItems.map(oi => oi.id),
      }),
    })
    if (!checkRes.ok) throw new Error('Napaka pri ustvarjanju čeka')
    const checkData = await checkRes.json()
    splitCheckId = checkData.id
  }
  const check = { id: splitCheckId }
  // 2. Ustvari N ločenih plačil (zadnje absorbira razliko za zaokroževanje)
  const payments: { amount: number; tipPortion: number }[] = []
  const splitBase = Math.floor((orderTotal / splitCount) * 100) / 100
  for (let i = 0; i < splitCount; i++) {
    const amount = i === splitCount - 1
      ? Math.round((orderTotal - splitBase * (splitCount - 1)) * 100) / 100
      : splitBase
    const tipPortion = i === splitCount - 1
      ? Math.round((tipAmount - Math.round((tipAmount / splitCount) * 100) / 100 * (splitCount - 1)) * 100) / 100
      : Math.round((tipAmount / splitCount) * 100) / 100
    payments.push({ amount, tipPortion })
  }
  for (let i = 0; i < payments.length; i++) {
    // P0 FIX: pošlji idempotencyKey — prepreči dvojno plačilo ob retry-ju.
    // Ključ je determinističen (checkId + index + znesek), tako da retry
    // z istimi vhodi dobi isti ključ → backend vrne obstoječe plačilo.
    const paymentRes = await authFetch('/api/payments', {
      method: 'POST',
      body: JSON.stringify({
        checkId: check.id,
        amount: payments[i].amount,
        tipAmount: payments[i].tipPortion,
        type: paymentMethod === 'cash' ? 'cash' : paymentMethod === 'card' ? 'card' : paymentMethod === 'mobile' ? 'mobile' : paymentMethod === 'split' ? 'split' : 'cash',
        idempotencyKey: makeSplitPaymentKey(check.id, i, payments[i].amount),
      }),
    })
    if (!paymentRes.ok) throw new Error(`Napaka pri ustvarjanju plačila ${i + 1}`)
  }
  // 3. Posodobi naročilo
  const orderRes = await authFetch(`/api/orders/${order.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      paymentStatus: 'paid',
      paymentMethod: 'split',
      ...(order.status === 'ready' ? { status: 'completed' } : {}),
      tip: tipAmount,
      totalWithTip: orderTotal + tipAmount,
    }),
  })
  if (!orderRes.ok) throw new Error('Napaka pri posodobitvi naročila')
  // FIX MEDIUM: Split payment — ustvari račun in FURS overitev
  try {
    const receiptRes = await authFetch(`/api/receipts/${order.id}`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod: 'split', isStorno: false }),
    })
    if (receiptRes.ok) {
      try {
        await authFetch('/api/furs', {
          method: 'POST',
          body: JSON.stringify({ orderId: order.id }),
        })
      } catch { /* FURS overitev ni kritična za split payment */ }
    }
  } catch { /* Račun ni bil ustvarjen — plačilo je še vedno veljavno */ }
  toast.success(`Plačilo uspešno! ${splitCount}x €${(orderTotal / splitCount).toFixed(2)}`)
  queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.cashRegister.all })
  queryClient.invalidateQueries({ queryKey: ['checks'] })
  if (onPaymentSuccess && order.id) onPaymentSuccess(order.id)
  resetAndClose()
}
