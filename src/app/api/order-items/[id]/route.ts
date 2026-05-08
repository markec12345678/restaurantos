import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// PUT /api/order-items/[id] — Update individual order item status
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const updateData: Record<string, unknown> = {}
  if (body.status) updateData.status = body.status
  if (body.notes !== undefined) updateData.notes = body.notes

  const orderItem = await db.orderItem.update({
    where: { id },
    data: updateData,
    include: { menuItem: true, order: { include: { table: true } } },
  })

  // Check if all items in the order are ready — auto-update order status
  if (body.status === 'ready' || body.status === 'served') {
    const allItems = await db.orderItem.findMany({
      where: { orderId: orderItem.orderId },
      select: { status: true },
    })

    const allReady = allItems.every(item =>
      item.status === 'ready' || item.status === 'served'
    )

    if (allReady && orderItem.order.status !== 'ready') {
      await db.order.update({
        where: { id: orderItem.orderId },
        data: { status: 'ready' },
      })
    }
  }

  return NextResponse.json(orderItem)
}
