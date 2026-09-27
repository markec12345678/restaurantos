// Glovo Idempotency Check — prepreči dvojno obdelavo istega naročila

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'
// R150 (repo issue #33): IntegrationLog.requestData/responseData sta zdaj JSONB
// (0022_json_fields) — tolerantno branje (legacy JSON string ALI native struct).
import { parseJsonPayload, type JsonFieldInput } from '@/lib/json-fields'

// FIX D-02: Natančno ujemanje order_id, NE substring contains
//
// FIX R112 (WEBHOOK-2, MED): opcionalen tx klient — AVTORITATIVNA dedup
// preverba teče tx-fresh ZNOTRAJ transakcije pod advisory lock-om
// 'delivery-webhook:{integrationId}:{glovoOrderId}' (glej glovo/route.ts).
// Prej je bil dedup scan integrationLog.requestData izven tx, log pa je bil
// zapisan ŠELE PO order.create — sočasna redeliverija je obšla oba pregleda
// (check-then-act okno) → dup plačanih naročil. Brez klienta ostane hitri
// pregled nad db (samo fast-path, ni vezava).
export async function findExistingGlovoOrder(
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
        // R150 (#33): stolpec je zdaj JSONB — string `contains` ne dela.
        // Glovo logi (glovo-logging) shranjujejo RAW body kot jsonb STRING
        // scalar → string_contains; migrirane/nove object vrstice → path.
        { requestData: { string_contains: `"order_id":"${orderId}"` } },
        { requestData: { string_contains: `"order_id": "${orderId}"` } },
        { requestData: { path: ['order_id'], equals: orderId } },
      ],
    },
  })
  const existingLog = candidateLogs.find(log => {
    // R150 (#33): tolerantno branje — native jsonb struct ali legacy string
    const data = parseJsonPayload(log.requestData as unknown as JsonFieldInput)
    return data.order_id === orderId
  })
  if (existingLog) {
    const resp = parseJsonPayload(existingLog.responseData as unknown as JsonFieldInput)
    const existingOrderId = typeof resp.orderId === 'string' ? resp.orderId : null
    return { type: 'log' as const, orderId: existingOrderId }
  }
  // Backward compat: preveri tudi notes
  // FIX R117 (H-2, P2): fallback je bil UNSCOPED — Glovo naročilo lokacije A
  // + Glovo webhook za lokacijo B je lahko replay-al A-jevo naročilo. Fallback
  // je zdaj scoped na webhook lokacijo (locationId na Order je NOT NULL).
  // Kanonska integrationLog pot ostane avtoritativna in nespremenjena.
  const existingOrder = await client.order.findFirst({
    where: { locationId: webhookLocationId, notes: { contains: `GLOVO:${orderId}` } },
  })
  if (existingOrder) {
    return { type: 'order' as const, orderId: existingOrder.id }
  }
  return null
}
