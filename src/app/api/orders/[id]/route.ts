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

  // When order is completed, free the table
  if (body.status === 'completed' && order.tableId) {
    await db.table.update({ where: { id: order.tableId }, data: { status: 'available' } })
    // Mark all items as served
    await db.orderItem.updateMany({
      where: { orderId: id, status: { in: ['pending', 'preparing', 'ready'] } },
      data: { status: 'served' },
    })
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
