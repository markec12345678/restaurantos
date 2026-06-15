// Pomožne funkcije za /api/orders/[id] route — dodaten extract
// Webhook emissions in akcije

import { db } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { emitEvent } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'
import { getAppUrl } from '@/lib/utils'
import { broadcastWS, freeTableIfNoActiveOrders } from './_helpers'

// Tip za order podatke za webhooks
export interface OrderWebhookData {
  id: string
  orderNumber: number
  total: number // already toNum'd
  tip: number // already toNum'd
  paymentMethod: string
  paymentStatus: string
  type: string
  status: string
  tableId: string | null
  notes: string
  deliveryInfo: { address: string } | null
  employeeId: string | null
  customerName: string | null
}

// Oddaj webhooks glede na spremembo statusa/plačila
export async function emitOrderWebhooks(
  id: string,
  existingOrder: OrderWebhookData,
  data: {
    status?: string
    paymentStatus?: string
    paymentMethod?: string
  },
) {
  // Webhook: order.paid — ko postane plačano
  if (data.paymentStatus === 'paid' && existingOrder.paymentStatus !== 'paid') {
    emitEvent('order.paid', {
      orderId: id, orderNumber: existingOrder.orderNumber,
      total: existingOrder.total,
      paymentMethod: data.paymentMethod || existingOrder.paymentMethod,
      tip: existingOrder.tip,
    }).catch(err => logger.error('API', '[Webhook] order.paid napaka:', err))
  }

  // Webhook: order.ready — ko postane pripravljeno
  if (data.status === 'ready' && existingOrder.status !== 'ready') {
    emitEvent('order.ready', {
      orderId: id, orderNumber: existingOrder.orderNumber,
    }).catch(err => logger.error('API', '[Webhook] order.ready napaka:', err))
  }

  // Webhook: order.delivered — ko je dostavljeno
  if (data.status === 'completed' && existingOrder.type === 'delivery') {
    const deliveryAddress = existingOrder.deliveryInfo?.address || existingOrder.notes || ''
    emitEvent('order.delivered', {
      orderId: id, orderNumber: existingOrder.orderNumber, deliveryAddress,
    }).catch(err => logger.error('API', '[Webhook] order.delivered napaka:', err))
  }

  // Webhook: order.updated — splošna posodobitev
  if (data.status && data.status !== 'cancelled') {
    emitEvent('order.updated', {
      orderId: id, changes: Object.keys(data), status: data.status,
    }).catch(err => logger.error('API', '[Webhook] order.updated napaka:', err))
  }
}

// Fire akcija — pošlji naročilo v kuhinjo
export async function handleFireAction(id: string) {
  await db.order.update({ where: { id }, data: { status: 'in-progress' } })
  await db.orderItem.updateMany({ where: { orderId: id, status: 'pending' }, data: { status: 'fired' } })

  const order = await db.order.findUnique({ where: { id } })
  broadcastWS('ORDER_FIRED', {
    orderId: id,
    orderNumber: order?.orderNumber,
  })

  const updated = await db.order.findUnique({
    where: { id },
    include: { table: true, orderItems: { include: { menuItem: true } } },
  })
  return NextResponse.json(deepToNumbers(updated))
}

// ─── Obdelaj item_status akcijo (PATCH) ───
export async function handleItemStatusUpdate(
  id: string, itemId: string, status: string,
  order: { id: string; status: string; orderNumber: number }
) {
  if (order.status === 'cancelled') {
    return { error: 'Preklicano naročilo ni mogoče spreminjati', status: 400 }
  }

  // FIX HIGH: Preveri, da OrderItem pripada temu naročilu
  const orderItem = await db.orderItem.findUnique({ where: { id: itemId } })
  if (!orderItem || orderItem.orderId !== id) {
    return { error: 'Artikel ne pripada temu naročilu', status: 400 }
  }

  await db.orderItem.update({ where: { id: itemId }, data: { status } })

  const updatedItem = await db.orderItem.findUnique({
    where: { id: itemId }, include: { menuItem: { select: { name: true } } },
  })

  // Preveri ali so vsi itemi ready/served/cancelled
  const allItems = await db.orderItem.findMany({ where: { orderId: id } })
  const allReady = allItems.every(i => ['ready', 'served', 'cancelled'].includes(i.status))
  const allServed = allItems.every(i => ['served', 'cancelled'].includes(i.status))

  // Auto-promote: ko so vsi itemi READY, naročilo postane READY
  if (allReady && order.status !== 'ready' && order.status !== 'completed') {
    await db.order.update({ where: { id }, data: { status: 'ready' } })
  }

  // Auto-promote: ko so vsi itemi SERVED, naročilo je pripravljeno za plačilo
  if (allServed && order.status !== 'completed') {
    await db.order.update({ where: { id }, data: { status: 'ready' } })
  }

  // ─── Broadcast za KDS ───
  broadcastWS('ITEM_STATUS_UPDATE', {
    orderId: id, orderNumber: order.orderNumber, itemId, status,
  })

  // ─── Obvestilo za natakarja ko je artikel PRIPRAVLJEN ───
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
      const totalItems = allItems.filter(i => i.status !== 'cancelled').length
      const readyCount = allItems.filter(i => ['ready', 'served'].includes(i.status)).length

      await fetch(`${getAppUrl()}/api/ws-broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'order_ready', channel: 'pos',
          data: {
            orderId: id, orderNumber: order.orderNumber,
            tableName: fullOrder?.table?.number?.toString() || null,
            tableNumber: fullOrder?.table?.number || null,
            waiterName: fullOrder?.customerName || null,
            waiterId: fullOrder?.employeeId || null,
            itemName: updatedItem?.menuItem?.name || 'Neznan artikel',
            itemQuantity: updatedItem.quantity,
            allReady, readyCount, totalItems, readyItems,
          },
        }),
      })
    } catch { /* broadcast ni kritičen */ }
  }

  return { success: true, allReady, allServed }
}

// ─── Soft delete naročila (DELETE) ───
export async function performOrderSoftDelete(
  id: string,
  order: {
    tableId: string | null
    orderNumber: number
    inventoryDeducted: boolean
    receipt: unknown[]
  },
  employeeId: string | undefined,
): Promise<void> {
  await db.order.update({
    where: { id },
    data: {
      status: 'cancelled', cancelReason: 'Izbrisano iz seznama',
      cancelledAt: new Date(), cancelledBy: employeeId || '',
    },
  })

  if (order.tableId) await freeTableIfNoActiveOrders(order.tableId)

  if (order.inventoryDeducted && order.receipt.length === 0) {
    const { returnStockForOrder } = await import('@/lib/stock-deduction')
    await returnStockForOrder(id, order.orderNumber, 'IZBRISANO IZ SEZNAMA (BREZ RAČUNA)')
  }

  const cancelReason = order.receipt.length > 0
    ? 'Izbrisano iz seznama (z računom)'
    : 'Izbrisano iz seznama (brez računa)'
  broadcastWS('ORDER_CANCELLED', { orderId: id, orderNumber: order.orderNumber, cancelReason })
}
