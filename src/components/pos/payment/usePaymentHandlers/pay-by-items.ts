'use client'

import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { type OrderForPayment, type PaymentExecContext } from './types'

// ============================================
// BY-ITEMS PLAČILO
// ============================================

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
    await authFetch('/api/payments', {
      method: 'POST',
      body: JSON.stringify({
        checkId: check.id,
        amount: guestTotal,
        tipAmount: 0,
        type: 'cash',
        status: 'completed',
        idempotencyKey: `payitems-${order.id}-g${g}-${guestTotal.toFixed(2)}`,
      }),
    })
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
