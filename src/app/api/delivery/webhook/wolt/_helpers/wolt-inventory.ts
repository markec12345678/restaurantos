// Wolt webhook — Inventory deduction in integracijsko beleženje

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { toNum } from '@/lib/decimal'
import type { WebhookOrderItem } from './wolt-schema'

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
