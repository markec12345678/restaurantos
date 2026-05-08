import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/receipts/[id] — Generate receipt data for an order
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const order = await db.order.findUnique({
    where: { id },
    include: {
      table: true,
      orderItems: {
        include: { menuItem: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Parse modifiers from JSON
  const receiptItems = order.orderItems.map(oi => {
    let modifiers: { name: string; price?: number }[] = []
    try {
      modifiers = JSON.parse(oi.modifiersJson || '[]')
    } catch { /* empty */ }

    return {
      id: oi.id,
      name: oi.menuItem.name,
      quantity: oi.quantity,
      unitPrice: oi.price,
      total: oi.price * oi.quantity,
      modifiers,
      notes: oi.notes,
      category: oi.menuItem.category?.name || '',
    }
  })

  const subtotal = receiptItems.reduce((sum, item) => sum + item.total, 0)
  const taxRate = order.tax / (order.subtotal || 1)
  const tax = order.tax
  const discount = order.discount
  const total = order.total

  // Restaurant details (configurable)
  const restaurant = {
    name: 'RestaurantOS',
    address: 'Terme Olimia, Podčetrtk 97, 3254 Podčetrtk',
    phone: '+386 3 818 30 00',
    taxId: 'SI12345678',
    message: 'Hvala za obisk! / Thank you for your visit!',
  }

  const receipt = {
    orderNumber: order.orderNumber,
    type: order.type,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    customerName: order.customerName,
    table: order.table ? { number: order.table.number, area: order.table.area } : null,
    notes: order.notes,
    createdAt: order.createdAt,
    items: receiptItems,
    subtotal,
    taxRate: Math.round(taxRate * 1000) / 10,
    tax,
    discount,
    total,
    restaurant,
    receiptNumber: `R-${String(order.orderNumber).padStart(6, '0')}`,
    receiptDate: new Date().toISOString(),
  }

  return NextResponse.json(receipt)
}
