// ============================================
// WOLT WEBHOOK HELPERS — Pomožne funkcije za Wolt webhook
// Wolt Merchant API
// ============================================
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { toNum, calcVat } from '@/lib/decimal'

// ---- Constants ----

export const WOLT_SIGNATURE_HEADER = 'x-wolt-signature'

// ---- Types ----

export interface WebhookOrderItem {
  menuItemId: string
  quantity: number
  price: number
  vatRate: number
  vatAmount: number
  discountAmount: number
  notes: string
  status: string
}

// ---- WebSocket Broadcast ----

export async function broadcastWS(type: string, payload: unknown) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`
    await fetch(`${appUrl}/api/ws-broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    })
  } catch {
    // WS strežnik ni na voljo
  }
}

// ---- Zod Schema ----

export const woltOrderSchema = z.object({
  order_id: z.string(),
  order_number: z.string().optional(),
  status: z.string().default('pending'),
  pickup: z.object({
    location: z.object({ formatted_address: z.string() }).optional(),
  }).optional(),
  delivery: z.object({
    location: z.object({ formatted_address: z.string() }),
    recipient: z.object({ name: z.string(), phone: z.string().optional() }).optional(),
    comment: z.string().optional(),
  }).optional(),
  items: z.array(z.object({
    item_id: z.string(),
    name: z.string(),
    count: z.number().min(1),
    unit_price: z.number().optional(),
    options: z.array(z.object({ id: z.string().optional(), name: z.string().optional() })).optional(),
  })).min(1),
  payment: z.object({ method: z.string().optional(), total: z.number().optional() }).optional(),
  notes: z.string().optional(),
})

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

// ---- Inventory Deduction ----
// FIX CRITICAL: Zmanjšaj zalogo ZNOTRAJ transakcije (prepreči race condition)

export async function deductInventoryForOrder(
  orderId: string,
  orderNumber: number,
  orderItems: WebhookOrderItem[],
  providerLabel: string,
) {
  try {
    await db.$transaction(async (tx) => {
      for (const item of orderItems) {
        const menuItem = await tx.menuItem.findUnique({
          where: { id: item.menuItemId },
          include: { recipeItems: { include: { inventoryItem: true } } },
        })
        if (!menuItem) continue
        for (const recipe of menuItem.recipeItems) {
          if (!recipe.inventoryItem) continue
          const deductQty = toNum(recipe.quantityPerServing) * item.quantity
          const currentInv = await tx.inventoryItem.findUnique({ where: { id: recipe.inventoryItem.id } })
          if (!currentInv) continue
          const updated = await tx.inventoryItem.updateMany({
            where: { id: recipe.inventoryItem.id, quantity: { gte: deductQty } },
            data: { quantity: { decrement: deductQty } },
          })
          if (updated.count > 0) {
            await tx.stockTransaction.create({
              data: {
                inventoryItemId: recipe.inventoryItem.id,
                type: 'sale',
                quantity: -deductQty,
                previousQty: toNum(currentInv.quantity),
                newQty: toNum(currentInv.quantity) - deductQty,
                costPerUnit: toNum(currentInv.costPerUnit),
                totalCost: deductQty * toNum(currentInv.costPerUnit),
                reason: `${providerLabel} naročilo #${orderNumber}`,
                orderId,
              },
            })
          }
        }
      }
      await tx.order.update({ where: { id: orderId }, data: { inventoryDeducted: true } })
    })
  } catch (stockErr: unknown) {
    logger.warn(providerLabel, 'Zmanjšanje zaloge ni uspelo:', stockErr)
  }
}

// ---- Integration Logging + Sync ----

export async function logAndSyncIntegration(
  integrationId: string,
  body: string,
  orderId: string,
  orderNumber: number,
) {
  await db.integrationLog.create({
    data: {
      integrationId,
      action: 'receive_order',
      direction: 'inbound',
      status: 'success',
      statusCode: 200,
      requestData: body.substring(0, 2000),
      responseData: JSON.stringify({ orderId, orderNumber }),
      durationMs: 0,
    },
  })
  await db.integration.update({
    where: { id: integrationId },
    data: { lastSyncAt: new Date(), lastSyncStatus: 'success', connectionStatus: 'connected' },
  })
}
