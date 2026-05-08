import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const type = searchParams.get('type')
  const paymentStatus = searchParams.get('paymentStatus')

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (type) where.type = type
  if (paymentStatus) where.paymentStatus = paymentStatus

  const orders = await db.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      table: true,
      orderItems: { include: { menuItem: true } },
    },
  })
  return NextResponse.json(orders)
}

export async function POST(req: Request) {
  const body = await req.json()

  const maxOrder = await db.order.findFirst({ orderBy: { orderNumber: 'desc' }, select: { orderNumber: true } })
  const orderNumber = (maxOrder?.orderNumber || 0) + 1

  const subtotal = body.orderItems.reduce((sum: number, item: { price: number; quantity: number }) => sum + item.price * item.quantity, 0)
  const taxRate = body.taxRate || 0.1
  const tax = subtotal * taxRate
  const discount = body.discount || 0
  const total = subtotal + tax - discount

  const order = await db.order.create({
    data: {
      orderNumber,
      type: body.type || 'dine-in',
      status: 'pending',
      tableId: body.tableId || null,
      customerName: body.customerName || '',
      customerPhone: body.customerPhone || '',
      subtotal,
      tax,
      discount,
      total,
      paymentStatus: 'unpaid',
      paymentMethod: '',
      notes: body.notes || '',
      employeeId: body.employeeId || null,
      orderItems: {
        create: body.orderItems.map((item: { menuItemId: string; quantity: number; price: number; notes?: string; modifiersJson?: string }) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          price: item.price,
          notes: item.notes || '',
          modifiersJson: item.modifiersJson || '[]',
          status: 'pending',
        })),
      },
    },
    include: {
      table: true,
      orderItems: { include: { menuItem: true } },
    },
  })

  if (body.tableId && body.type === 'dine-in') {
    await db.table.update({ where: { id: body.tableId }, data: { status: 'occupied' } })
  }

  return NextResponse.json(order)
}
