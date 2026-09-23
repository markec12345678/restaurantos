// Glovo Idempotency Check — prepreči dvojno obdelavo istega naročila

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

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
  const existingOrder = await client.order.findFirst({
    where: { notes: { contains: `GLOVO:${orderId}` } },
  })
  if (existingOrder) {
    return { type: 'order' as const, orderId: existingOrder.id }
  }
  return null
}
