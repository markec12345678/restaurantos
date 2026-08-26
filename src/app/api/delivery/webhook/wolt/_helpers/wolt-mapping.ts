// Wolt webhook — Idempotency check in preslikava artiklov

import { db } from '@/lib/db'
import { toNum, calcVat } from '@/lib/decimal'
import { woltOrderSchema } from './wolt-schema'
import type { WebhookOrderItem } from './wolt-schema'
import { z } from 'zod'

// ---- Idempotency Check ----
// FIX D-02: Natančno ujemanje order_id, NE substring contains

export async function findExistingWoltOrder(integrationId: string, orderId: string) {
  const candidateLogs = await db.integrationLog.findMany({
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
  const existingOrder = await db.order.findFirst({
    where: { notes: { contains: `WOLT:${orderId}` } },
  })
  if (existingOrder) {
    return { type: 'order' as const, orderId: existingOrder.id }
  }
  return null
}

// ---- Item Mapping ----

export async function mapWoltItemsToOrderItems(
  items: z.infer<typeof woltOrderSchema>['items']
): Promise<WebhookOrderItem[]> {
  const orderItems: WebhookOrderItem[] = []
  for (const item of items) {
    // FIX: Only match available menu items (prevent ordering unavailable items)
    const menuItem = await db.menuItem.findFirst({
      where: { isAvailable: true, OR: [{ id: item.item_id }, { name: item.name }] },
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
