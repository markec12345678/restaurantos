import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// POST /api/orders/[id]/add-items — Dodaj artikle k obstoječemu naročilu
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { items } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Potreben je seznam artiklov' }, { status: 400 })
    }

    // Pridobi obstoječe naročilo
    const order = await db.order.findUnique({
      where: { id },
      include: { orderItems: { include: { menuItem: true } }, table: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
    }

    if (order.status === 'completed' || order.status === 'cancelled') {
      return NextResponse.json({ error: 'Naročilo je že zaključeno ali preklicano' }, { status: 400 })
    }

    // Dodaj nove artikle
    const newItems = await db.$transaction(async (tx) => {
      const created = []
      for (const item of items) {
        // Pridobi artikel za DDV stopnjo
        const menuItem = await tx.menuItem.findUnique({ where: { id: item.menuItemId } })
        const vatRate = menuItem?.vatRate ?? 22.0
        
        const orderItem = await tx.orderItem.create({
          data: {
            orderId: id,
            menuItemId: item.menuItemId,
            quantity: item.quantity || 1,
            price: item.price,
            notes: item.notes || '',
            modifiersJson: item.modifiersJson || '[]',
            status: 'pending',
            vatRate,
          },
          include: { menuItem: true },
        })
        created.push(orderItem)
      }

      // Preračunaj skupne zneske s per-item DDV
      const allItems = [...order.orderItems, ...created]
      const subtotal = allItems.reduce((sum, oi) => sum + oi.price * oi.quantity, 0)
      const tax = allItems.reduce((sum, oi) => {
        const rate = oi.vatRate ?? 22.0
        return sum + oi.price * oi.quantity * (rate / 100)
      }, 0)
      const total = subtotal + tax - order.discount

      await tx.order.update({
        where: { id },
        data: { subtotal, tax, total },
      })

      return created
    })

    // Pridobi posodobljeno naročilo
    const updatedOrder = await db.order.findUnique({
      where: { id },
      include: {
        table: true,
        orderItems: { include: { menuItem: true } },
      },
    })

    return NextResponse.json({ order: updatedOrder, addedItems: newItems.length })
  } catch (error) {
    console.error('Add items error:', error)
    return NextResponse.json({ error: 'Napaka pri dodajanju artiklov' }, { status: 500 })
  }
}
