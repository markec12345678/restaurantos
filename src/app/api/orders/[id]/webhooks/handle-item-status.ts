// Obdelaj item_status akcijo (PATCH)

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { broadcastWS } from '../_helpers'
import { wsBroadcastEvent } from '@/lib/ws-server-broadcast'

// FIX R112-A (ORD-3, MED-HIGH — TOCTOU razred iz R100–R111): prej je bil
// `order` argument ZASTAREL read iz rute, item update NEPOGOJEN in
// auto-promotion BREZ status guard-a:
//   (a) cancelled guard je tekmoval proti zastarelemu branju (preklic med
//       read in write je ušel);
//   (b) 'ready'/'preparing' KDS tap je PREPIPAL status:'voided' iz void
//       claima (PUT /api/order-items/[id] updateMany { voided: false });
//   (c) auto-promotion je lahko REGRESIRAL 'completed'/'ready' → 'ready'
//       (plačano naročilo nazaj v kuhinjo).
// Sedaj: Serializable tx + advisory lock 'order-write:{orderId}' (isti ključ
// kot add-items / void recalc / checks / qr-pay kanon) + tx-fresh guardi +
// CAS updateMany na artiklu IN naročilu.
export async function handleItemStatusUpdate(
  id: string, itemId: string, status: string,
  _order: { id: string; status: string; orderNumber: number; locationId?: string | null },
) {
  // Zastarel argument je SAMO fallback za broadcast metadata — avtoritativni
  // guardi tečejo tx-fresh (spodaj).
  let freshOrderNumber = _order.orderNumber
  let freshLocationId: string | null | undefined = _order.locationId
  let promotedToReady = false

  const result = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`order-write:${id}`}))`

    const freshOrder = await tx.order.findUnique({
      where: { id },
      select: { id: true, status: true, orderNumber: true, locationId: true },
    })
    if (!freshOrder) return { error: 'Naročilo ni najdeno', status: 404 }
    if (freshOrder.status === 'cancelled') {
      return { error: 'Preklicano naročilo ni mogoče spreminjati', status: 400 }
    }
    freshOrderNumber = freshOrder.orderNumber
    freshLocationId = freshOrder.locationId

    // Artikel mora pripadati temu naročilu (tx-fresh, ne route read)
    const orderItem = await tx.orderItem.findFirst({ where: { id: itemId, orderId: id } })
    if (!orderItem) {
      return { error: 'Artikel ne pripada temu naročilu', status: 400 }
    }
    if (orderItem.voided) {
      return { error: 'Voidan artikel ni mogoče spreminjati', status: 409 }
    }

    // CAS na artiklu — tekmuje z void claimom (PUT /api/order-items/[id]):
    // void VEDNO zmaga nad KDS status tapom (count 0 = void je pravkar zmagal).
    const itemClaim = await tx.orderItem.updateMany({
      where: { id: itemId, orderId: id, voided: false },
      data: { status },
    })
    if (itemClaim.count === 0) {
      return { error: 'Artikel je v obdelavi (void/sočasna sprememba) — osvežite', status: 409 }
    }

    // Auto-promotion (združeni prejšnji allReady/allServed bloka — oba sta
    // ciljala isti 'ready'): CAS izključno iz 'pending'/'in-progress' —
    // NIKOLI regresije iz 'ready'/'completed' (plačano naročilo ostane zaključeno).
    const allItems = await tx.orderItem.findMany({ where: { orderId: id }, select: { status: true } })
    const allReady = allItems.every(i => ['ready', 'served', 'cancelled'].includes(i.status))
    const allServed = allItems.every(i => ['served', 'cancelled'].includes(i.status))
    if ((allReady || allServed) && ['pending', 'in-progress'].includes(freshOrder.status)) {
      const promo = await tx.order.updateMany({
        where: { id, status: { in: ['pending', 'in-progress'] } },
        data: { status: 'ready' },
      })
      promotedToReady = promo.count > 0
    }

    return { success: true as const, allReady, allServed, promotedToReady }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  }).catch((err: unknown) => {
    // R112 error kontrakt: P2034 → strukturiran 409 (nikoli 500)
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
      return { error: 'Naročilo je v obdelavi (sočasen dostop) — poskusite znova', status: 409 }
    }
    throw err
  })

  if ('error' in result) return result

  const updatedItem = await db.orderItem.findUnique({
    where: { id: itemId }, include: { menuItem: { select: { name: true } } },
  })

  // Broadcast za KDS (orderNumber/locationId tx-fresh)
  broadcastWS('ITEM_STATUS_UPDATE', {
    orderId: id, orderNumber: freshOrderNumber, itemId, status,
    // WS AUDIT: locationId za per-location dostavo (KDS druge lokacije ne vidi)
    locationId: freshLocationId ?? null,
  })

  // Obvestilo za natakarja ko je artikel PRIPRAVLJEN
  if (status === 'ready' && updatedItem) {
    try {
      const fullOrder = await db.order.findUnique({
        where: { id },
        include: {
          table: true,
          orderItems: { where: { status: 'ready' }, include: { menuItem: { select: { name: true } } } },
        },
      })
      const readyItems = (fullOrder?.orderItems || []).map(i => ({ name: i.menuItem?.name || 'Artikel', quantity: i.quantity }))
      // R112: enaka semantika kot prej — totalItems = vsi ne-voidani/aktivni,
      // readyCount = ready + served (allItems tx seznam je ven tx; tu je
      // best-effort osvežitev za notifikacijo)
      const broadcastItems = await db.orderItem.findMany({ where: { orderId: id }, select: { status: true } })
      const totalItems = broadcastItems.filter(i => i.status !== 'cancelled').length
      const readyCount = broadcastItems.filter(i => ['ready', 'served'].includes(i.status)).length

      // WS AUDIT 2026-09-09: prej HTTP fetch (401 + 'order_ready' ni bil v enum).
      // Zdaj: direkten globalThis.__wsBroadcast klic z 'order_ready' dogodkom.
      wsBroadcastEvent('order_ready', {
        orderId: id, orderNumber: freshOrderNumber,
        tableName: fullOrder?.table?.number?.toString() || null,
        tableNumber: fullOrder?.table?.number || null,
        waiterName: fullOrder?.customerName || null,
        waiterId: fullOrder?.employeeId || null,
        itemName: updatedItem?.menuItem?.name || 'Neznan artikel',
        itemQuantity: updatedItem.quantity,
        allReady: result.allReady, readyCount, totalItems, readyItems,
        // WS AUDIT: locationId za per-location dostavo (natakarji druge lokacije ne vidijo)
        locationId: fullOrder?.locationId ?? freshLocationId ?? null,
      })
    } catch { /* broadcast ni kritičen */ }
  }

  void promotedToReady
  return { success: true, allReady: result.allReady, allServed: result.allServed }
}
