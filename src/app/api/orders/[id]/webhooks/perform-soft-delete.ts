// Soft delete naročila (DELETE)

import { db } from '@/lib/db'
import { broadcastWS, freeTableIfNoActiveOrders } from '../_helpers'

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
