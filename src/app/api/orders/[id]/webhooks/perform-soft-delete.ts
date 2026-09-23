// Soft delete naročila (DELETE)

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { broadcastWS, freeTableIfNoActiveOrders } from '../_helpers'

// FIX R112-A (ORD-4, HIGH — TOCTOU razred iz R100–R111): preklic je bil
// NEPOGOJEN update — v race-u s plačilom (checks/qr-pay/wallet kanon) je
// PREKLICAL PLAČANO naročilo: denar prejet, status 'cancelled', zaloga
// vrnjena, prihodkovna poročila narobe. Sedaj: Serializable tx + advisory
// lock 'order-write:{orderId}' (isti ključ kot checks/qr-pay/add-items/
// void-recalc kanon) + tx-fresh guardi (status IN paymentStatus) + CAS
// updateMany. Rezultat je strukturiran { ok, reason } — ruta preslika v
// 404/400/409 (plačano naročilo gre VEDNO na storno/povračilo, FURS ZDDV-1).
export type SoftDeleteResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'already_cancelled' | 'completed' | 'paid' | 'conflict' }

export async function performOrderSoftDelete(
  id: string,
  order: {
    tableId: string | null
    orderNumber: number
    inventoryDeducted: boolean
    receipt: unknown[]
    locationId?: string | null
  },
  employeeId: string | undefined,
): Promise<SoftDeleteResult> {
  const claim = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`order-write:${id}`}))`

    // tx-fresh guardi — stale route read NE sme odločati (preklic/plačilo
    // med route read in tx bi sicer ušel guardom)
    const fresh = await tx.order.findUnique({
      where: { id },
      select: { status: true, paymentStatus: true },
    })
    if (!fresh) return { ok: false as const, reason: 'not_found' as const }
    if (fresh.status === 'cancelled') return { ok: false as const, reason: 'already_cancelled' as const }
    if (fresh.status === 'completed') return { ok: false as const, reason: 'completed' as const }
    if (fresh.paymentStatus === 'paid') return { ok: false as const, reason: 'paid' as const }

    // CAS žig — stale concurrent writer (plačilo, drug preklic) ne sme zmagati
    const res = await tx.order.updateMany({
      where: { id, status: fresh.status, paymentStatus: { not: 'paid' } },
      data: {
        status: 'cancelled', cancelReason: 'Izbrisano iz seznama',
        cancelledAt: new Date(), cancelledBy: employeeId || '',
      },
    })
    return res.count === 1
      ? { ok: true as const }
      : { ok: false as const, reason: 'conflict' as const }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  })

  if (!claim.ok) return claim

  // Stranski učinki ŠELE po uspešnem CAS žigu (prej: tudi ob izgubljeni tekmi)
  if (order.tableId) await freeTableIfNoActiveOrders(order.tableId)

  if (order.inventoryDeducted && order.receipt.length === 0) {
    const { returnStockForOrder } = await import('@/lib/stock-deduction')
    await returnStockForOrder(id, order.orderNumber, 'IZBRISANO IZ SEZNAMA (BREZ RAČUNA)')
  }

  const cancelReason = order.receipt.length > 0
    ? 'Izbrisano iz seznama (z računom)'
    : 'Izbrisano iz seznama (brez računa)'
  broadcastWS('ORDER_CANCELLED', {
    orderId: id, orderNumber: order.orderNumber, cancelReason,
    // WS AUDIT: locationId za per-location dostavo
    locationId: order.locationId ?? null,
  })

  return claim
}
