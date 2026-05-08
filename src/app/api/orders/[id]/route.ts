import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const order = await db.order.update({
    where: { id },
    data: {
      status: body.status,
      paymentStatus: body.paymentStatus,
      paymentMethod: body.paymentMethod,
      notes: body.notes,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      discount: body.discount,
      total: body.total,
    },
    include: {
      table: true,
      orderItems: { include: { menuItem: true } },
    },
  })

  if (body.status === 'completed' && order.tableId) {
    await db.table.update({ where: { id: order.tableId }, data: { status: 'available' } })
  }
  if (body.status === 'cancelled' && order.tableId) {
    const activeOrders = await db.order.count({
      where: { tableId: order.tableId, status: { in: ['pending', 'in-progress', 'ready'] } },
    })
    if (activeOrders <= 1) {
      await db.table.update({ where: { id: order.tableId }, data: { status: 'available' } })
    }
  }

  if (body.paymentStatus === 'paid' && order.tableId) {
    // Keep table occupied until order is completed
  }

  return NextResponse.json(order)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.orderItem.deleteMany({ where: { orderId: id } })
  await db.order.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
