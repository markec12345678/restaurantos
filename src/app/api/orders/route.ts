import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// Helper za WebSocket broadcast (varen klic — deluje tudi brez WS strežnika)
async function broadcastWS(type: string, payload: unknown) {
  try {
    await fetch('http://localhost:3000/api/ws-broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    })
  } catch {
    // WS strežnik ni na voljo — tiho prezri
  }
}

// Helper za samodejni tisk kuhinjskega naročila
async function autoPrintKitchenOrder(order: Record<string, unknown>) {
  try {
    await fetch('http://localhost:3000/api/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'order', orderId: order.id }),
    })
  } catch {
    // Tiskanje ni na voljo — tiho prezri
  }
}

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

  // Multi-DDV: pridobi vatRate za vsak artiklov iz baze
  const menuItemIds = body.orderItems.map((item: { menuItemId: string }) => item.menuItemId)
  const menuItems = await db.menuItem.findMany({
    where: { id: { in: menuItemIds } },
    select: { id: true, vatRate: true },
  })
  const vatMap = new Map(menuItems.map(mi => [mi.id, mi.vatRate]))

  // Izračun z multi-DDV po stopnjah
  let subtotal = 0
  let totalTax = 0
  const orderItemsData = body.orderItems.map((item: { menuItemId: string; quantity: number; price: number; notes?: string; modifiersJson?: string }) => {
    const vatRate = vatMap.get(item.menuItemId) ?? 22.0
    const itemBase = item.price * item.quantity
    const vatAmount = itemBase * (vatRate / 100)
    subtotal += itemBase
    totalTax += vatAmount
    return {
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      price: item.price,
      vatRate,
      vatAmount,
      notes: item.notes || '',
      modifiersJson: item.modifiersJson || '[]',
      status: 'pending' as const,
    }
  })

  const discount = body.discount || 0
  const total = subtotal + totalTax - discount

  const order = await db.order.create({
    data: {
      orderNumber,
      type: body.type || 'dine-in',
      status: 'pending',
      tableId: body.tableId || null,
      diningOptionId: body.diningOptionId || null,
      revenueCenterId: body.revenueCenterId || null,
      customerName: body.customerName || '',
      customerPhone: body.customerPhone || '',
      subtotal,
      tax: totalTax,
      discount,
      total,
      paymentStatus: 'unpaid',
      paymentMethod: '',
      notes: body.notes || '',
      employeeId: body.employeeId || null,
      orderItems: {
        create: orderItemsData,
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

  // WebSocket: obvesti KDS o novem naročilu
  broadcastWS('NEW_ORDER', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    type: order.type,
    tableId: order.tableId,
    total: order.total,
  })

  // Samodejni tisk kuhinjskega naročila (v ozadju)
  autoPrintKitchenOrder(order as unknown as Record<string, unknown>)

  return NextResponse.json(order)
}
