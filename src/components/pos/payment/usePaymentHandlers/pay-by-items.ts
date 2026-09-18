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
  loyaltyAccountId,
  queryClient,
  onPaymentSuccess,
  resetAndClose,
}: {
  order: OrderForPayment
  splitCount: number
  guestAssignments: Record<string, number>
  /** RUNDA 47: zvestobni račun za earn ob plačilu po artiklih (parity s split —
   *  prej by-items NIKOLI ni pripel točk). Vsak gostov plačil prišteje svoj del. */
  loyaltyAccountId?: string | null
} & PaymentExecContext) {
  // FIX TypeError: t?.filter is not a function — order.orderItems je lahko undefined
  const orderItems = Array.isArray(order?.orderItems) ? order.orderItems : []
  const guestCount = Math.max(splitCount, 2)
  for (let g = 1; g <= guestCount; g++) {
    const guestItemIds = orderItems
      .filter(oi => guestAssignments[oi.id] === g)
      .map(oi => oi.id)
    if (guestItemIds.length === 0) continue
    const checkRes = await authFetch('/api/checks', {
      method: 'POST',
      body: JSON.stringify({ orderId: order.id, orderItemIds: guestItemIds }),
    })
    if (!checkRes.ok) throw new Error('Napaka pri ustvarjanju čeka')
    const check = await checkRes.json()
    const guestTotal = orderItems
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
        // RUNDA 47: earn točk tudi ob plačilu po artiklih (prej tiho izgubljeno)
        ...(loyaltyAccountId ? { loyaltyAccountId } : {}),
      }),
    })
  }
  // P2-UX FIX (stale order): pošlji expectedUpdatedAt (optimistic locking) —
  // glej useProcessPayment za podrobnosti.
  await authFetch(`/api/orders/${order.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      paymentStatus: 'paid',
      paymentMethod: 'split',
      ...(order.status === 'ready' ? { status: 'completed' } : {}),
      ...(order.updatedAt ? { expectedUpdatedAt: order.updatedAt } : {}),
    }),
  })
  toast.success('Plačilo po artiklih uspešno!')
  queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.zReport.all }) // živi Z-osnutek (runda 11)
  queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
  if (onPaymentSuccess && order.id) onPaymentSuccess(order.id)
  resetAndClose()
}
