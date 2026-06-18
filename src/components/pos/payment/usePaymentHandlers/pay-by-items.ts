'use client'

import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { type OrderForPayment, type PaymentExecContext } from './types'

// ============================================
// BY-ITEMS PLAČILO
// ============================================

// P0 FIX: Deterministični idempotencyKey za vsako plačilo po artiklih.
// Ključ je sestavljen iz stabilnih vhodov (orderId + gostIndex + znesek),
// tako da retry po napaki (ista konfiguracija) dobi isti ključ → backend
// vrne obstoječe plačilo (idempotent). Različni gostje imajo različen
// index `g` → različni ključi → ni kolizije.
function makePayByItemsKey(orderId: string, guestIndex: number, amount: number): string {
  return `payitems-${orderId}-g${guestIndex}-${amount.toFixed(2)}`
}

export async function executePayByItems({
  order,
  splitCount,
  guestAssignments,
  queryClient,
  onPaymentSuccess,
  resetAndClose,
}: {
  order: OrderForPayment
  splitCount: number
  guestAssignments: Record<string, number>
} & PaymentExecContext) {
  const guestCount = Math.max(splitCount, 2)
  for (let g = 1; g <= guestCount; g++) {
    const guestItemIds = order.orderItems
      .filter(oi => guestAssignments[oi.id] === g)
      .map(oi => oi.id)
    if (guestItemIds.length === 0) continue
    const checkRes = await authFetch('/api/checks', {
      method: 'POST',
      body: JSON.stringify({ orderId: order.id, orderItemIds: guestItemIds }),
    })
    if (!checkRes.ok) throw new Error('Napaka pri ustvarjanju čeka')
    const check = await checkRes.json()
    const guestTotal = order.orderItems
      .filter(oi => guestAssignments[oi.id] === g)
      .reduce((sum, oi) => sum + oi.price * oi.quantity, 0)
    // P0 FIX: pošlji idempotencyKey — prepreči dvojno plačilo ob retry-ju.
    const paymentRes = await authFetch('/api/payments', {
      method: 'POST',
      body: JSON.stringify({
        checkId: check.id,
        amount: guestTotal,
        tipAmount: 0,
        type: 'cash',
        status: 'completed',
        idempotencyKey: makePayByItemsKey(order.id, g, guestTotal),
      }),
    })
    if (!paymentRes.ok) throw new Error(`Napaka pri plačilu gosta ${g}`)
  }
  await authFetch(`/api/orders/${order.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      paymentStatus: 'paid',
      paymentMethod: 'split',
      ...(order.status === 'ready' ? { status: 'completed' } : {}),
    }),
  })
  toast.success('Plačilo po artiklih uspešno!')
  queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
  if (onPaymentSuccess && order.id) onPaymentSuccess(order.id)
  resetAndClose()
}
