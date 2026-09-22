// ============================================
// TABLE OPS — ENOTNI PISALNI KANON (R108)
// ============================================
// R108 (TOCTOU razred iz R100–R107): POST /api/tables/transfer in
// POST /api/tables/merge sta imeli ISTO forenziko kot R105 Goods Receipt:
//
//   OR-4 (HIGH, transfer): seznam aktivnih naročil prebran IZVEN tx → tx
//      NEPOGOJENO premika STALE naročila → sočasen payment/merge/cancel =
//      PLAČANO ali PREKLICANO naročilo prenešeno na ciljno mizo (denarna
//      sled razcepljena čez mizi) + source miza lahko ostane 'available'
//      z odprtim naročilom (tloris pokvarjen).
//   OR-5 (HIGH, merge): items + orders prebrani IZVEN tx → (a) artikli
//      dodani source naročilu med branjem in tx ostanejo na PREKLICANEM
//      naročilu (orphaned revenue), (b) cancel source naročila NEPOGOJEN →
//      plačano naročilo preklicano (denarna sled pretrgana), (c) recalc
//      target totals iz stale items + stale discount/tip → lost update na
//      totals (PODRAČUNAVANJE, R106 INV-2 dvojček).
//
// KANON (zrcali R106 stock-mutations / R107 points-mutations / R108
// order-mutations):
//   $transaction(Serializable) + pg_advisory_xact_lock(hashtext('table-ops:'
//   + tableId)) na OBEH mizah (določba po SORTED ključih → deterministicen
//   vrstni red, deadlock nemogoč) + tx-fresh scoped re-read obeh miz IN
//   seznamov naročil/artiklov + CAS updateMany za cancel (status+paymentStatus
//   v where → count 0 → 409) + strukturirani { error, status } throw-i +
//   P2002/P2034 → 409 v catch bloku rut.
//
// Lock graf (deadlock-varen): table-ops:* je edina vrsta ključavnic v teh
// dveh kanonih (nikoli order-write — smer order → table je enosmerna,
// glej order-mutations.ts).

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { toNum, round2 } from '@/lib/decimal'

export function tableOpsLockKey(tableId: string): string {
  return 'table-ops:' + tableId
}

/**
 * Deterministicen vrstni red ključavnic (sorted, unique) — dva sočasna
 * merge/transfer sta si nasprotno usmerjena (A→B ∥ B→A) brez tega →
 * ABBA deadlock.
 */
export async function acquireTableOpsLocks(
  tx: Prisma.TransactionClient,
  tableIds: (string | null | undefined)[],
): Promise<void> {
  const ids = [
    ...new Set(tableIds.filter((id): id is string => typeof id === 'string' && id.length > 0)),
  ].sort()
  for (const id of ids) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tableOpsLockKey(id)}))`
  }
}

/** Aktivni statusi naročil (pariteta z legacy filtri v obeh rutah). */
export const ACTIVE_ORDER_STATUSES = ['pending', 'in-progress', 'ready'] as const
const ACTIVE_PAYMENT_STATUSES = ['unpaid', 'partial'] as const

function fail(error: string, status: number): never {
  throw { error, status }
}

// ─── OR-4: tables/transfer kanon ───

export interface TransferTableOrdersData {
  sourceTableId: string
  targetTableId: string
  /** Če podan — prenese samo to naročilo (pariteta z legacy API-jem). */
  orderId?: string | null
  locationId: string | null
}

export interface TransferTableOrdersResult {
  transferredOrders: { id: string; orderNumber: number }[]
  sourceFreed: boolean
}

export async function transferTableOrders(
  data: TransferTableOrdersData,
): Promise<TransferTableOrdersResult> {
  return db.$transaction(
    async (tx) => {
      // OBE mizi pod ključavnico (sorted → deadlock-varen vrstni red)
      await acquireTableOpsLocks(tx, [data.sourceTableId, data.targetTableId])

      // TX-FRESH scoped re-read obeh miz (prej: stale outer findFirst par)
      const [sourceTable, targetTable] = await Promise.all([
        tx.table.findFirst({
          where: { id: data.sourceTableId, ...(data.locationId ? { locationId: data.locationId } : {}) },
        }),
        tx.table.findFirst({
          where: { id: data.targetTableId, ...(data.locationId ? { locationId: data.locationId } : {}) },
        }),
      ])
      if (!sourceTable) fail('Izvorna miza ni najdena', 404)
      if (!targetTable) fail('Ciljna miza ni najdena', 404)
      if (
        sourceTable.locationId &&
        targetTable.locationId &&
        sourceTable.locationId !== targetTable.locationId
      ) {
        fail('Mizi nista na isti lokaciji', 400)
      }

      // TX-FRESH seznam aktivnih naročil (prej: stale outer seznam, tx
      // NEPOGOJENO premikal zastarele vrstice)
      const ordersToTransfer = await tx.order.findMany({
        where: {
          tableId: data.sourceTableId,
          status: { in: [...ACTIVE_ORDER_STATUSES] },
          paymentStatus: { in: [...ACTIVE_PAYMENT_STATUSES] },
          ...(data.locationId ? { locationId: data.locationId } : {}),
          ...(data.orderId ? { id: data.orderId } : {}),
        },
        select: { id: true, orderNumber: true },
      })
      if (ordersToTransfer.length === 0) {
        fail('Ni aktivnih naročil za prenos', 400)
      }

      for (const order of ordersToTransfer) {
        await tx.order.update({
          where: { id: order.id },
          data: { tableId: data.targetTableId },
        })
      }

      // Izvorna miza prosta, če ni več odprtih naročil (TX-FRESH count,
      // scoped — prej: count brez scope-a)
      const remainingOrders = await tx.order.count({
        where: {
          tableId: data.sourceTableId,
          status: { in: [...ACTIVE_ORDER_STATUSES] },
          paymentStatus: { in: [...ACTIVE_PAYMENT_STATUSES] },
          ...(data.locationId ? { locationId: data.locationId } : {}),
        },
      })
      if (remainingOrders === 0) {
        await tx.table.update({
          where: { id: data.sourceTableId },
          data: { status: 'available' },
        })
      }

      // Ciljna miza zasedena
      await tx.table.update({
        where: { id: data.targetTableId },
        data: { status: 'occupied' },
      })

      return {
        transferredOrders: ordersToTransfer,
        sourceFreed: remainingOrders === 0,
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

// ─── OR-5: tables/merge kanon ───

export interface MergeTablesData {
  sourceTableId: string
  targetTableId: string
  locationId: string | null
}

export interface MergeTablesResult {
  mergedOrderIds: string[]
  totalItemsMerged: number
  targetOrderRecalculated: boolean
}

export async function mergeTables(data: MergeTablesData): Promise<MergeTablesResult> {
  return db.$transaction(
    async (tx) => {
      // OBE mizi pod ključavnico (sorted → deadlock-varen vrstni red)
      await acquireTableOpsLocks(tx, [data.sourceTableId, data.targetTableId])

      // TX-FRESH scoped re-read obeh miz
      const [sourceTable, targetTable] = await Promise.all([
        tx.table.findFirst({
          where: { id: data.sourceTableId, ...(data.locationId ? { locationId: data.locationId } : {}) },
        }),
        tx.table.findFirst({
          where: { id: data.targetTableId, ...(data.locationId ? { locationId: data.locationId } : {}) },
        }),
      ])
      if (!sourceTable) fail('Izvorna miza ni najdena', 404)
      if (!targetTable) fail('Ciljna miza ni najdena', 404)
      if (
        sourceTable.locationId &&
        targetTable.locationId &&
        sourceTable.locationId !== targetTable.locationId
      ) {
        fail('Mizi nista na isti lokaciji', 400)
      }

      // TX-FRESH seznam source naročil
      const sourceOrders = await tx.order.findMany({
        where: {
          tableId: data.sourceTableId,
          status: { in: [...ACTIVE_ORDER_STATUSES] },
          paymentStatus: { in: [...ACTIVE_PAYMENT_STATUSES] },
          ...(data.locationId ? { locationId: data.locationId } : {}),
        },
        include: { orderItems: true },
      })
      if (sourceOrders.length === 0) {
        fail('Izvorna miza nima aktivnih naročil za združitev', 400)
      }

      // Delno plačana naročila (parity z legacy fixom — zdaj TX-FRESH)
      const partiallyPaid = sourceOrders.filter(o => o.paymentStatus === 'partial')
      if (partiallyPaid.length > 0) {
        fail(
          'Naročilo že ima delno plačilo — združitev ni mogoča. Uporabi prenos/povračilo.',
          400,
        )
      }

      // TX-FRESH target naročila
      const targetOrders = await tx.order.findMany({
        where: {
          tableId: data.targetTableId,
          status: { in: [...ACTIVE_ORDER_STATUSES] },
          paymentStatus: { in: [...ACTIVE_PAYMENT_STATUSES] },
          ...(data.locationId ? { locationId: data.locationId } : {}),
        },
      })

      let mergedOrderIds: string[] = []
      let totalItemsMerged = 0
      let targetOrderRecalculated = false

      if (targetOrders.length === 0) {
        // Preprost prenos — premakni vsa source naročila na target mizo
        for (const order of sourceOrders) {
          await tx.order.update({
            where: { id: order.id },
            data: { tableId: data.targetTableId },
          })
          mergedOrderIds.push(order.id)
          totalItemsMerged += order.orderItems.length
        }
      } else {
        const targetOrder = targetOrders[0]

        for (const sourceOrder of sourceOrders) {
          // OR-5a: artikli prebrani TX-FRESH pod ključavnico (prej: stale
          // outer seznam → artikli dodani med branjem in tx ostali na
          // preklicanem naročilu = orphaned revenue)
          const items = await tx.orderItem.findMany({
            where: { orderId: sourceOrder.id },
            select: { id: true },
          })
          for (const item of items) {
            await tx.orderItem.update({
              where: { id: item.id },
              data: { orderId: targetOrder.id },
            })
            totalItemsMerged++
          }

          // OR-5b: CAS cancel — status+paymentStatus v where (prej:
          // NEPOGOJEN update → plačano naročilo preklicano). Race
          // (sočasen payment med lockom in CAS-om) → count 0 → 409.
          const cancelled = await tx.order.updateMany({
            where: {
              id: sourceOrder.id,
              status: { in: [...ACTIVE_ORDER_STATUSES] },
              paymentStatus: 'unpaid',
            },
            data: {
              status: 'cancelled',
              paymentStatus: 'cancelled',
              cancelReason: `Združeno z mizo ${targetTable.number}`,
              tableId: null,
            },
          })
          if (cancelled.count === 0) {
            fail('Naročilo je bilo v medtem spremenjeno (plačilo/preklic) — združitev prekinjena', 409)
          }
        }
        mergedOrderIds = [targetOrder.id]

        // OR-5c: recalc target totals iz TX-FRESH items + TX-FRESH
        // discount/tip (prej: stale items + stale targetOrder → lost update)
        const targetFresh = await tx.order.findUnique({ where: { id: targetOrder.id } })
        if (!targetFresh) fail('Ciljno naročilo ni najdeno', 404)
        const updatedItems = await tx.orderItem.findMany({
          where: { orderId: targetOrder.id, voided: false },
          select: { price: true, quantity: true, vatAmount: true },
        })
        const subtotal = round2(updatedItems.reduce((s, oi) => s + toNum(oi.price) * oi.quantity, 0))
        const tax = round2(updatedItems.reduce((s, oi) => s + toNum(oi.vatAmount), 0))
        // Ohrani absolutni popust in tip ciljnega naročila (popust ne more
        // preseči osnove — parity z recalculateAffectedChecks v checks API)
        const discount = Math.min(toNum(targetFresh.discount), subtotal)
        const tip = toNum(targetFresh.tip)
        const total = round2(subtotal + tax - discount)
        await tx.order.update({
          where: { id: targetOrder.id },
          data: { subtotal, tax, total, totalWithTip: round2(total + tip) },
        })
        targetOrderRecalculated = true
      }

      // Source miza → prosto; target miza → zasedeno (pod ključavnicama)
      await tx.table.update({
        where: { id: data.sourceTableId },
        data: { status: 'available' },
      })
      await tx.table.update({
        where: { id: data.targetTableId },
        data: { status: 'occupied' },
      })

      return { mergedOrderIds, totalItemsMerged, targetOrderRecalculated }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}
