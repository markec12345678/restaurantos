// Obdelaj item_status akcijo (PATCH)

import { db } from '@/lib/db'
import { getAppUrl } from '@/lib/utils'
import { broadcastWS } from '../_helpers'

export async function handleItemStatusUpdate(
  id: string, itemId: string, status: string,
  order: { id: string; status: string; orderNumber: number }
) {
  if (order.status === 'cancelled') {
    return { error: 'Preklicano naročilo ni mogoče spreminjati', status: 400 }
  }

  // Preveri, da OrderItem pripada temu naročilu
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

  // Broadcast za KDS
  broadcastWS('ITEM_STATUS_UPDATE', {
    orderId: id, orderNumber: order.orderNumber, itemId, status,
  })

  // Obvestilo za natakarja ko je artikel PRIPRAVLJEN
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
