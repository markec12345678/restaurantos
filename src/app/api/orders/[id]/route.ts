import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  // Build update data — only include fields that are present
  const updateData: Record<string, unknown> = {}
  if (body.status !== undefined) updateData.status = body.status
  if (body.paymentStatus !== undefined) updateData.paymentStatus = body.paymentStatus
  if (body.paymentMethod !== undefined) updateData.paymentMethod = body.paymentMethod
  if (body.notes !== undefined) updateData.notes = body.notes
  if (body.customerName !== undefined) updateData.customerName = body.customerName
  if (body.customerPhone !== undefined) updateData.customerPhone = body.customerPhone
  if (body.discount !== undefined) updateData.discount = body.discount
  if (body.total !== undefined) updateData.total = body.total
  if (body.tip !== undefined) updateData.tip = body.tip
  if (body.totalWithTip !== undefined) updateData.totalWithTip = body.totalWithTip
  if (body.splitCount !== undefined) updateData.splitCount = body.splitCount

  const order = await db.order.update({
    where: { id },
    data: updateData,
    include: {
      table: true,
      orderItems: { include: { menuItem: true } },
    },
  })

  // When order moves to in-progress, also mark pending items as preparing
  if (body.status === 'in-progress') {
    await db.orderItem.updateMany({
      where: { orderId: id, status: 'pending' },
      data: { status: 'preparing' },
    })
  }

  // When order is completed, free the table & auto-deduct inventory
  if (body.status === 'completed') {
    if (order.tableId) {
      await db.table.update({ where: { id: order.tableId }, data: { status: 'available' } })
    }
    // Mark all items as served
    await db.orderItem.updateMany({
      where: { orderId: id, status: { in: ['pending', 'preparing', 'ready'] } },
      data: { status: 'served' },
    })

    // Avtomatsko razknjiževanje zalog glede na normativi
    const orderItems = await db.orderItem.findMany({ where: { orderId: id } })
    for (const oi of orderItems) {
      // Poišči inventorizacijski artikel povezan s tem menijem
      const invItem = await db.inventoryItem.findFirst({
        where: { menuItemId: oi.menuItemId },
      })
      if (invItem && invItem.servingsPerUnit > 0) {
        // Izračunaj porabo: količina naročenih × (1 / servingsPerUnit) enot zaloge
        const unitsPerServing = 1 / invItem.servingsPerUnit
        const totalUnitsToDeduct = oi.quantity * unitsPerServing
        const previousQty = invItem.quantity
        const newQty = Math.max(0, previousQty - totalUnitsToDeduct)

        await db.$transaction(async (tx) => {
          await tx.inventoryItem.update({
            where: { id: invItem.id },
            data: { quantity: newQty },
          })
          await tx.stockTransaction.create({
            data: {
              inventoryItemId: invItem.id,
              type: 'sale',
              quantity: -totalUnitsToDeduct,
              previousQty,
              newQty,
              costPerUnit: invItem.costPerUnit,
              totalCost: totalUnitsToDeduct * invItem.costPerUnit,
              reason: `Prodaja - naročilo #${order.orderNumber}`,
              orderId: id,
            },
          })
        })
      }
    }
  }

  // When order is cancelled, free the table if no other active orders
  if (body.status === 'cancelled' && order.tableId) {
    const activeOrders = await db.order.count({
      where: { tableId: order.tableId, status: { in: ['pending', 'in-progress', 'ready'] } },
    })
    if (activeOrders <= 1) {
      await db.table.update({ where: { id: order.tableId }, data: { status: 'available' } })
    }
  }

  // Re-fetch to get updated items
  const updatedOrder = await db.order.findUnique({
    where: { id },
    include: {
      table: true,
      orderItems: { include: { menuItem: true } },
    },
  })

  return NextResponse.json(updatedOrder || order)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.orderItem.deleteMany({ where: { orderId: id } })
  await db.order.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
