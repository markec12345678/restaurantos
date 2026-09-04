// ============================================
// PUSH NOTIFICATION HELPERS — Specifična obvestila
// ============================================

import { db } from '@/lib/db'
import { broadcastPushNotification, type PushSubscription, type PushPayload } from './index'
import { logger } from '@/lib/logger'

/**
 * Pošlji push notification vsem aktivnim zaposlenim z določeno vlogo
 */
async function notifyRole(
  roles: string[],
  payload: PushPayload
): Promise<void> {
  try {
    // Pridobi vse aktivne subscripcije za te vloge
    const subs = await db.pushSubscription.findMany({
      where: {
        isActive: true,
        employee: {
          status: 'active',
          role: { in: roles },
        },
      },
      select: { endpoint: true, p256dhKey: true, authKey: true },
    })

    if (subs.length === 0) return

    const subscriptions: PushSubscription[] = subs.map(s => ({
      endpoint: s.endpoint,
      keys: { p256dh: s.p256dhKey, auth: s.authKey },
    }))

    const result = await broadcastPushNotification(subscriptions, payload)

    // Počisti potekle subscripcije
    if (result.expired.length > 0) {
      await db.pushSubscription.updateMany({
        where: { endpoint: { in: result.expired } },
        data: { isActive: false },
      })
    }
  } catch (err: unknown) {
    logger.error('PUSH', 'Napaka pri pošiljanju push notifications:', err)
  }
}

/**
 * Obvesti kuharje o novem naročilu
 */
export async function notifyNewOrder(orderNumber: number, tableNumber: number | null, itemCount: number): Promise<void> {
  await notifyRole(['admin', 'manager', 'staff'], {
    title: `🍽️ Novo naročilo #${orderNumber}`,
    body: tableNumber
      ? `Miza ${tableNumber} • ${itemCount} artiklov`
      : `${itemCount} artiklov`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    tag: `order-${orderNumber}`,
    requireInteraction: true,
    data: { orderNumber, tableNumber, type: 'new_order' },
    actions: [
      { action: 'view', title: 'Poglej KDS' },
    ],
  })
}

/**
 * Obvesti natakarja da je artikel pripravljen
 */
export async function notifyItemReady(
  orderNumber: number,
  tableNumber: number | null,
  itemName: string
): Promise<void> {
  await notifyRole(['admin', 'manager', 'staff'], {
    title: `✅ Pripravljeno: ${itemName}`,
    body: tableNumber
      ? `Naročilo #${orderNumber} • Miza ${tableNumber}`
      : `Naročilo #${orderNumber}`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    tag: `ready-${orderNumber}`,
    data: { orderNumber, tableNumber, type: 'item_ready' },
    actions: [
      { action: 'serve', title: 'Postreži' },
    ],
  })
}

/**
 * Obvesti o novem dostavnem naročilu (Glovo/Wolt/Bolt)
 */
export async function notifyDeliveryOrder(
  orderNumber: number,
  platform: string,
  itemCount: number
): Promise<void> {
  await notifyRole(['admin', 'manager', 'staff'], {
    title: `🛵 ${platform} dostava #${orderNumber}`,
    body: `${itemCount} artiklov • ${platform} naročilo`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    tag: `delivery-${orderNumber}`,
    requireInteraction: true,
    data: { orderNumber, platform, type: 'delivery_order' },
    actions: [
      { action: 'view', title: 'Poglej KDS' },
    ],
  })
}

/**
 * Obvesti o nizki zalogi
 */
export async function notifyLowStock(itemName: string, currentQty: number, minQty: number): Promise<void> {
  await notifyRole(['admin', 'manager'], {
    title: `⚠️ Nizka zaloga: ${itemName}`,
    body: `Trenutno: ${currentQty} • Minimum: ${minQty}`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    tag: `stock-${itemName}`,
    data: { itemName, currentQty, minQty, type: 'low_stock' },
  })
}
