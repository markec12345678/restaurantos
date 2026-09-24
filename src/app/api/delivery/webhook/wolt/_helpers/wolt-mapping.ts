// Wolt webhook — Idempotency check in preslikava artiklov

import { db } from '@/lib/db'
import { toNum, calcVat } from '@/lib/decimal'
import { woltOrderSchema } from './wolt-schema'
import type { WebhookOrderItem } from './wolt-schema'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'

// ---- Idempotency Check ----
// FIX D-02: Natančno ujemanje order_id, NE substring contains
//
// FIX R112 (WEBHOOK-2, MED): opcionalen tx klient — AVTORITATIVNA dedup
// preverba teče tx-fresh ZNOTRAJ transakcije pod advisory lock-om
// 'delivery-webhook:{integrationId}:{woltOrderId}' (glej wolt/route.ts).
// Prej je bil dedup scan integrationLog.requestData izven tx, log pa je bil
// zapisan ŠELE PO order.create — sočasna redeliverija je obšla oba pregleda
// (check-then-act okno) → dup plačanih naročil. Brez klienta ostane hitri
// pregled nad db (samo fast-path, ni vezava).
export async function findExistingWoltOrder(
  integrationId: string,
  orderId: string,
  webhookLocationId: string,
  client: Prisma.TransactionClient = db,
) {
  const candidateLogs = await client.integrationLog.findMany({
    where: {
      integrationId,
      action: 'receive_order',
      direction: 'inbound',
      status: 'success',
      OR: [
        { requestData: { contains: `"order_id":"${orderId}"` } },
        { requestData: { contains: `"order_id": "${orderId}"` } },
      ],
    },
  })
  const existingLog = candidateLogs.find(log => {
    try {
      const data = JSON.parse(log.requestData || '{}')
      return data.order_id === orderId
    } catch { return false }
  })
  if (existingLog) {
    const existingOrderId = (() => { try { return JSON.parse(existingLog.responseData || '{}').orderId } catch { return null } })()
    return { type: 'log' as const, orderId: existingOrderId }
  }
  // Backward compat: preveri tudi notes
  // FIX R117 (H-2, P2): fallback je bil UNSCOPED — Wolt naročilo lokacije A
  // + Wolt webhook za lokacijo B je lahko replay-al A-jevo naročilo (tuji
  // orderId leak + tiho pogoltnjen webhook). Fallback je zdaj scoped na
  // webhook lokacijo (locationId na Order je NOT NULL — trrd tenant žig).
  // Kanonska integrationLog pot (zgornja) je nespremenjena in ostane
  // avtoritativna; fallback pokriva samo zgodovinske zapise brez loga +
  // okno med tx commitom in log zapisom.
  const existingOrder = await client.order.findFirst({
    where: { locationId: webhookLocationId, notes: { contains: `WOLT:${orderId}` } },
  })
  if (existingOrder) {
    return { type: 'order' as const, orderId: existingOrder.id }
  }
  return null
}

// ---- Item Mapping ----

// FIX R112 (WEBHOOK-3, MED): lookup je bil NESCEOPAN
// (findFirst isAvailable + OR[id, name] brez lokacije) → artikel TUJEGA
// tenanta se je lahko ujemale po imenu/ID (napačna cena/DDV). Sedaj je
// locationId OBVEZEN parameter in lookup je scoped prek MODEL A verige
// category → menu → locationId. Tx-fresh (klicatelj poda tx klienta).
export async function mapWoltItemsToOrderItems(
  items: z.infer<typeof woltOrderSchema>['items'],
  locationId: string,
  client: Prisma.TransactionClient = db,
): Promise<WebhookOrderItem[]> {
  const orderItems: WebhookOrderItem[] = []
  for (const item of items) {
    // FIX: Only match available menu items (prevent ordering unavailable items)
    const menuItem = await client.menuItem.findFirst({
      where: {
        isAvailable: true,
        category: { menu: { locationId } },
        OR: [{ id: item.item_id }, { name: item.name }],
      },
    })
    if (menuItem) {
      orderItems.push({
        menuItemId: menuItem.id,
        quantity: item.count,
        price: toNum(menuItem.price),
        vatRate: toNum(menuItem.vatRate),
        vatAmount: calcVat(toNum(menuItem.price), menuItem.vatRate),
        discountAmount: 0,
        notes: item.options?.map(o => o.name).filter(Boolean).join(', ') || '',
        status: 'pending' as const,
      })
    }
  }
  return orderItems
}
