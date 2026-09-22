// ============================================
// ORDER WRITE — ENOTNI PISALNI KANON (R108)
// ============================================
// R108 (TOCTOU razred iz R100–R107): POST /api/orders/[id]/add-items in
// POST /api/orders/[id]/transfer sta imela ISTO forenziko kot R105 Goods
// Receipt / R106 zalogovne poti:
//
//   OR-1 (HIGH, add-items — lost update na totals): `createOrderItemsAndRecalculate`
//      je re-read naročila izvedel v tx, ampak BREZ izolacije (default
//      ReadCommitted) in brez ključavnice → dva sočasna add-items oba
//      prebereta isti seznam OrderItems, vsak doda svoje in OBADVA
//      NEPOGOJENO prepišeta totals → zadnji zapis z NSVEŽIM seznamom
//      (brez tujih artiklov) → total prenizek = PODRAČUNAVANJE
//      (revenue leak). Sočasen complete/pay med re-readom in update-om →
//      totals prepišejo že zaključeno naročilo.
//   OR-1b (HIGH, add-items — status TOCTOU): stale status check izven tx +
//      tx brez CAS → artikli dodani na completed/cancelled naročilo.
//   OR-2 (HIGH, transfer): NEPOGOJEN `update({ where: { id }, tableId })`
//      brez tx-fresh re-reada in brez status preverbe → prenos
//      completed/cancelled naročila + mizna stanja (available/occupied)
//      prepišana nad sočasen merge/transfer → tloris lokacije pokvarjen.
//   OR-3 (HIGH, add-items): razknjižba zaloge v LOČENI transakciji PO
//      tx naročila → crash med njima = artikli brez odbitka zaloge.
//
// KANON (zrcali R106 stock-mutations / R107 points-mutations):
//   $transaction(Serializable) + pg_advisory_xact_lock(hashtext('order-write:'
//   + orderId)) + tx-fresh scoped re-read + validacija/cas SAMO proti svežim
//   podatkom + razknjižba ZNOTRAJ iste tx (deductStockForItemsInTx) +
//   strukturirani { error, status } throw-i (structuredErrorResponse v ruti)
//   + P2002/P2034 → 409 v catch bloku.
//
// Lock graf (deadlock-varen): order-write:* je VEDNO prva ključavnica;
// table-ops:* (table-ops.ts) nikoli ne zahteva order-write — smer grafa je
// enosmerna (order → table), cikli nemogoči.

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { toNum, round2, isPositive } from '@/lib/decimal'
import { parseModifiersJson, fetchModifierPriceMap } from '../../_helpers/order-items'
import { deductStockForItemsInTx } from '@/lib/stock-deduction/deduct-added'
import type { StockDeductionItem, StockDeductionResult } from '@/lib/stock-deduction/types'

export function orderWriteLockKey(orderId: string): string {
  return 'order-write:' + orderId
}

/** Aktivni statusi naročil (pariteta s tables/transfer + merge filtri). */
export const ACTIVE_ORDER_STATUSES = ['pending', 'in-progress', 'ready'] as const

function fail(error: string, status: number): never {
  throw { error, status }
}

function emptyStockResult(): StockDeductionResult {
  return { success: true, deducted: [], lowStockAlerts: [], errors: [] }
}

// ─── OR-1/OR-1b/OR-3: add-items kanon ───

export interface AddItemsToOrderData {
  orderId: string
  /** Session scope (null = super-admin globalno) — vedno zoži re-read. */
  locationId: string | null
  orderItems: { menuItemId: string; quantity: number; notes?: string; modifiersJson?: string }[]
}

export interface AddItemsToOrderResult {
  created: Record<string, unknown>[]
  stockResult: StockDeductionResult
  orderNumber: number
  orderLocationId: string | null
}

export async function addItemsToOrder(data: AddItemsToOrderData): Promise<AddItemsToOrderResult> {
  return db.$transaction(
    async (tx) => {
      // Ključavnica naročila — serializira vse pisalne toke na tem naročilu
      // (add-items ∥ add-items ∥ transfer ∥ complete).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${orderWriteLockKey(data.orderId)}))`

      // TX-FRESH scoped re-read (prej: stale outer read določal status + totals base)
      const order = await tx.order.findFirst({
        where: { id: data.orderId, ...(data.locationId ? { locationId: data.locationId } : {}) },
        include: { orderItems: { include: { menuItem: true } }, table: true },
      })
      if (!order) fail('Naročilo ni najdeno', 404)

      // OR-1b: status CAS — validacija SAMO proti svežim podatkom
      if (order.status === 'completed' || order.status === 'cancelled') {
        fail('Naročilo je že zaključeno ali preklicano', 400)
      }

      // Preveri, da vsi artikli obstajajo IN pripadajo lokaciji naročila
      // MODEL A (tenant scope audit 2026-09-09): veriga MenuItem → Category
      // → Menu → locationId mora SOVPADATI z Order.locationId.
      const validatedItems = new Map<string, Awaited<ReturnType<typeof tx.menuItem.findFirst>>>()
      for (const item of data.orderItems) {
        const menuItem = await tx.menuItem.findFirst({
          where: {
            id: item.menuItemId,
            category: { menu: { locationId: order.locationId } },
          },
        })
        if (!menuItem) {
          fail(`Artikel ${item.menuItemId} ni najden ali ni na voljo na tej lokaciji`, 400)
        }
        validatedItems.set(item.menuItemId, menuItem)
      }

      // FIX BUG-13: DB cene modifierjev (server-authoritative)
      const modifierPriceMap = await fetchModifierPriceMap(
        data.orderItems.map(i => i.menuItemId),
        order.locationId,
        tx,
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma OrderItem & { menuItem } from include
      const created: any[] = []
      for (const item of data.orderItems) {
        const menuItem = validatedItems.get(item.menuItemId)!
        const vatRate = toNum(menuItem.vatRate)
        const basePrice = toNum(menuItem.price)
        const dbModPrices = modifierPriceMap.get(item.menuItemId)
        let modifierDelta = 0
        for (const mod of parseModifiersJson(item.modifiersJson)) {
          const dbPrice = dbModPrices?.get(mod.name.toLowerCase())
          modifierDelta += dbPrice !== undefined ? dbPrice : mod.price
        }
        const serverPrice = round2(basePrice + modifierDelta)
        const itemBase = serverPrice * item.quantity
        const vatAmount = round2(itemBase * (vatRate / 100))

        const orderItem = await tx.orderItem.create({
          data: {
            orderId: data.orderId,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            price: serverPrice,
            notes: item.notes,
            modifiersJson: item.modifiersJson,
            status: 'pending',
            vatRate,
            vatAmount,
            // Podeduj discountAmount proporcionalno od starševskega naročila
            // (TX-FRESH vrednosti — prej stale currentOrder.discount/subtotal)
            discountAmount: isPositive(order.discount) && isPositive(order.subtotal)
              ? round2(serverPrice * item.quantity / toNum(order.subtotal) * toNum(order.discount))
              : 0,
          },
          include: { menuItem: true },
        })
        created.push(orderItem)
      }

      // OR-1: totals iz TX-FRESH seznama artiklov (pod lock + Serializable je
      // ta seznam edini resnični — lost update nemogoč)
      const allItems = [...order.orderItems, ...created]
      const subtotal = allItems.reduce((sum, oi) => sum + toNum(oi.price) * oi.quantity, 0)
      // FIX HIGH (parity z legacy helperjem): uporabi obstoječi vatAmount za stare artikle
      const tax = allItems.reduce((sum, oi) => {
        if ('vatAmount' in oi && toNum(oi.vatAmount) > 0) {
          return sum + toNum(oi.vatAmount)
        }
        const rate = oi.vatRate != null ? toNum(oi.vatRate) : 22.0
        return sum + toNum(oi.price) * oi.quantity * (rate / 100)
      }, 0)
      const discount = Math.min(toNum(order.discount), subtotal)
      const total = round2(subtotal + tax - discount)
      const totalWithTip = round2(total + toNum(order.tip))

      await tx.order.update({
        where: { id: data.orderId },
        data: { subtotal, tax, discount, total, totalWithTip },
      })

      // OR-3: razknjižba zaloge v ISTI transakciji (prej: ločena tx PO
      // commit-u naročila → crash = artikli brez odbitka zaloge)
      const stockResult = emptyStockResult()
      const deductionItems: StockDeductionItem[] = data.orderItems.map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
      }))
      await deductStockForItemsInTx(
        tx,
        deductionItems,
        order.orderNumber,
        order.id,
        order.locationId,
        stockResult,
      )

      return {
        created: created as Record<string, unknown>[],
        stockResult,
        orderNumber: order.orderNumber,
        orderLocationId: order.locationId,
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

// ─── OR-2: order transfer kanon ───

export interface TransferOrderToTableData {
  orderId: string
  locationId: string | null
  newTableId: string
}

export interface TransferOrderToTableResult {
  order: Record<string, unknown>
  fromTableId: string | null
  toTableId: string
}

export async function transferOrderToTable(
  data: TransferOrderToTableData,
): Promise<TransferOrderToTableResult> {
  return db.$transaction(
    async (tx) => {
      // Ključavnica naročila (prva v lock grafu — glej header)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${orderWriteLockKey(data.orderId)}))`

      // TX-FRESH scoped re-read (prej: stale outer read, tx NEPOGOJEN update)
      const order = await tx.order.findFirst({
        where: { id: data.orderId, ...(data.locationId ? { locationId: data.locationId } : {}) },
        include: { table: true },
      })
      if (!order) fail('Naročilo ni najdeno', 404)

      // OR-2: status CAS — prenos samo aktivnih naročil (prej: completed/
      // cancelled naročilo je bilo možno prenesti → FURS/revizijska neskladja)
      if (order.status === 'completed' || order.status === 'cancelled') {
        fail('Naročilo je že zaključeno ali preklicano — prenos ni mogoč', 400)
      }

      const newTable = await tx.table.findFirst({
        where: { id: data.newTableId, ...(data.locationId ? { locationId: data.locationId } : {}) },
      })
      if (!newTable) fail('Ciljna miza ni najdena', 404)

      if (order.tableId === data.newTableId) {
        fail('Naročilo je že na tej mizi', 400)
      }

      const fromTableId = order.tableId

      // Ključavnica izvorne mize (druga v lock grafu — order → table smer;
      // prej: sočasen merge/transfer/seat na isti mizi = prepišana stanja)
      if (fromTableId) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${('table-ops:' + fromTableId)}))`
      }
      // Ciljna miza — isti vzorec
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${('table-ops:' + data.newTableId)}))`

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: { tableId: data.newTableId },
        include: { table: true },
      })

      // Stara miza → available (če ni več drugih aktivnih naročil)
      if (fromTableId) {
        const activeOrdersOnOldTable = await tx.order.count({
          where: {
            tableId: fromTableId,
            id: { not: order.id },
            status: { in: [...ACTIVE_ORDER_STATUSES] },
          },
        })
        if (activeOrdersOnOldTable === 0) {
          await tx.table.update({
            where: { id: fromTableId },
            data: { status: 'available' },
          })
        }
      }

      // Nova miza → occupied
      await tx.table.update({
        where: { id: data.newTableId },
        data: { status: 'occupied' },
      })

      return {
        order: updatedOrder as unknown as Record<string, unknown>,
        fromTableId,
        toTableId: data.newTableId,
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}
