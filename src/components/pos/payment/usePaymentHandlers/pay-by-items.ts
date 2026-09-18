'use client'

import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { type OrderForPayment, type PaymentExecContext } from './types'
import { redeemPointsNeeded } from '@/lib/loyalty-tiers'

// ============================================
// BY-ITEMS PLAČILO
// ============================================

export async function executePayByItems({
  order,
  splitCount,
  guestAssignments,
  loyaltyAccountId,
  loyaltyRedeem,
  loyaltyBalance,
  pointsValue,
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
  /** RUNDA 49: unovčenje — vsak gostov del plačila gre kot type 'loyalty' s
   *  točkami za svoj znesek (parity z Eno plačilo / deljeno). Earn za ta
   *  plačila namerno ne teče (backend izpusti type==='loyalty'). */
  loyaltyRedeem?: boolean
  /** RUNDA 49: stanje izbranega računa — predhodna odjava preverjanje PRED
   *  prvim delnim plačilom (prepreči pol-failed zaporedje gostov). */
  loyaltyBalance?: number | null
  /** RUNDA 49: vrednost točke v EUR (> 0, normalizirano v usePaymentDialog) */
  pointsValue?: number
} & PaymentExecContext) {
  // FIX TypeError: t?.filter is not a function — order.orderItems je lahko undefined
  const orderItems = Array.isArray(order?.orderItems) ? order.orderItems : []
  const guestCount = Math.max(splitCount, 2)
  // RUNDA 49: prekompot gostovh zneskov — potrebno ZA predhodno preverjanje
  // stanja pri unovčenju (prej je znesek računan inline v plačilni zanki,
  // kar ni dalo možnosti, da preverimo vse skupaj PRED prvim POST).
  const guestTotals: { guest: number; itemIds: string[]; total: number }[] = []
  for (let g = 1; g <= guestCount; g++) {
    const guestItems = orderItems.filter(oi => guestAssignments[oi.id] === g)
    if (guestItems.length === 0) continue
    guestTotals.push({
      guest: g,
      itemIds: guestItems.map(oi => oi.id),
      total: guestItems.reduce((sum, oi) => sum + oi.price * oi.quantity, 0),
    })
  }
  const redeemActive = !!loyaltyRedeem && !!loyaltyAccountId && (pointsValue ?? 0) > 0
  const redeemPointsTotal = redeemActive
    ? guestTotals.reduce((sum, gt) => sum + redeemPointsNeeded(gt.total, pointsValue as number), 0)
    : 0
  if (redeemActive && typeof loyaltyBalance === 'number' && loyaltyBalance < redeemPointsTotal) {
    throw new Error(
      `Račun ima ${loyaltyBalance} točk, unovčenje zahteva ${redeemPointsTotal} — plačilo preklicano.`,
    )
  }
  for (const { guest, itemIds, total } of guestTotals) {
    const checkRes = await authFetch('/api/checks', {
      method: 'POST',
      body: JSON.stringify({ orderId: order.id, orderItemIds: itemIds }),
    })
    if (!checkRes.ok) throw new Error('Napaka pri ustvarjanju čeka')
    const check = await checkRes.json()
    await authFetch('/api/payments', {
      method: 'POST',
      body: JSON.stringify({
        checkId: check.id,
        amount: total,
        tipAmount: 0,
        // RUNDA 49: ob unovčenju je gostov del type 'loyalty' s številom točk
        type: redeemActive ? 'loyalty' : 'cash',
        status: 'completed',
        idempotencyKey: `payitems-${order.id}-g${guest}-${total.toFixed(2)}`,
        // RUNDA 47: earn točk tudi ob plačilu po artiklih (prej tiho izgubljeno)
        // RUNDA 49: ob unovčenju še točke za TA gostov znesek (ceil)
        ...(redeemActive ? { loyaltyPointsUsed: redeemPointsNeeded(total, pointsValue as number) } : {}),
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
