import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
  const menuItems = await db.menuItem.findMany({ take: 10 })
  const tables = await db.table.findMany()

  if (menuItems.length === 0) {
    return NextResponse.json({ error: 'No menu items found. Seed data first.' }, { status: 400 })
  }

  const now = new Date()
  const ordersCreated = []

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const ordersPerDay = Math.floor(Math.random() * 8) + 5
    for (let i = 0; i < ordersPerDay; i++) {
      const date = new Date(now)
      date.setDate(date.getDate() - dayOffset)
      date.setHours(Math.floor(Math.random() * 12) + 8, Math.floor(Math.random() * 60))

      const numItems = Math.floor(Math.random() * 4) + 1
      const selectedItems = []
      for (let j = 0; j < numItems; j++) {
        const item = menuItems[Math.floor(Math.random() * menuItems.length)]
        const existing = selectedItems.find(s => s.menuItemId === item.id)
        if (existing) {
          existing.quantity += 1
        } else {
          selectedItems.push({ menuItemId: item.id, price: item.price, quantity: Math.floor(Math.random() * 3) + 1 })
        }
      }

      const subtotal = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
      const tax = subtotal * 0.1
      const discount = Math.random() > 0.8 ? Math.floor(subtotal * 0.1) : 0
      const total = subtotal + tax - discount

      const type = ['dine-in', 'takeout', 'delivery'][Math.floor(Math.random() * 3)]
      const statuses = ['pending', 'in-progress', 'ready', 'completed']
      const statusIdx = dayOffset === 0 ? Math.floor(Math.random() * 3) : 3
      const status = statuses[statusIdx]

      const maxOrder = await db.order.findFirst({ orderBy: { orderNumber: 'desc' }, select: { orderNumber: true } })
      const orderNumber = (maxOrder?.orderNumber || 0) + 1

      const tableId = type === 'dine-in' && tables.length > 0 ? tables[Math.floor(Math.random() * tables.length)].id : null

      const order = await db.order.create({
        data: {
          orderNumber,
          type,
          status,
          tableId,
          customerName: ['Jože N.', 'Maja S.', 'Miha R.', 'Ana L.', 'Tomaž V.', 'Ema B.'][Math.floor(Math.random() * 6)],
          customerPhone: '',
          subtotal,
          tax,
          discount,
          total,
          paymentStatus: status === 'completed' ? 'paid' : (Math.random() > 0.5 ? 'paid' : 'unpaid'),
          paymentMethod: status === 'completed' ? ['cash', 'card', 'valuto'][Math.floor(Math.random() * 3)] : '',
          notes: '',
          createdAt: date,
          orderItems: {
            create: selectedItems.map(item => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              price: item.price,
              notes: '',
              status: status === 'completed' ? 'served' : 'pending',
            })),
          },
        },
      })
      ordersCreated.push(order)
    }
  }

  return NextResponse.json({ created: ordersCreated.length })
}
