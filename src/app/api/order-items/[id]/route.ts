import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// Helper za WebSocket broadcast
async function broadcastWS(type: string, payload: unknown) {
  try {
    await fetch('http://localhost:3000/api/ws-broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    })
  } catch {
    // WS strežnik ni na voljo
  }
}

// PUT /api/order-items/[id] — Update individual order item (status, void, etc.)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const updateData: Record<string, unknown> = {}
  if (body.status) updateData.status = body.status
  if (body.notes !== undefined) updateData.notes = body.notes

  // === VOID OPERACIJA ===
  // Void pomeni, da se artikel poniči (ne zaračuna stranki)
  // Zahteva razlog (voidReasonId ali voidReasonText)
  if (body.voided === true) {
    updateData.voided = true
    if (body.voidReasonId) updateData.voidReasonId = body.voidReasonId
    updateData.status = 'voided'
  }

  const orderItem = await db.orderItem.update({
    where: { id },
    data: updateData,
    include: { menuItem: true, order: { include: { table: true } } },
  })

  // Če je void, preračunaj zneske naročila
  if (body.voided === true) {
    const allItems = await db.orderItem.findMany({
      where: { orderId: orderItem.orderId },
    })

    // Preračun brez voidanih artiklov
    let newSubtotal = 0
    let newTax = 0
    for (const item of allItems) {
      if (!item.voided) {
        const itemBase = item.price * item.quantity
        const itemVat = itemBase * (item.vatRate / 100)
        newSubtotal += itemBase
        newTax += itemVat
      }
    }

    const order = await db.order.findUnique({ where: { id: orderItem.orderId } })
    const discount = order?.discount || 0
    const newTotal = newSubtotal + newTax - discount

    await db.order.update({
      where: { id: orderItem.orderId },
      data: {
        subtotal: Math.round(newSubtotal * 100) / 100,
        tax: Math.round(newTax * 100) / 100,
        total: Math.max(0, Math.round(newTotal * 100) / 100),
      },
    })

    // Zabeleži void transakcijo v dnevnik
    try {
      await db.stockTransaction.create({
        data: {
          inventoryItemId: 'void-log',
          type: 'void',
          quantity: -orderItem.quantity,
          previousQty: 0,
          newQty: 0,
          costPerUnit: orderItem.price,
          totalCost: -(orderItem.price * orderItem.quantity),
          reason: `VOID: ${orderItem.menuItem.name} - ${body.voidReasonText || 'Razlog ni naveden'}`,
          orderId: orderItem.orderId,
          employeeName: '',
        },
      })
    } catch {
      // Void log ni kritičen, če ne uspe
    }
  }

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

  // WebSocket: obvesti KDS o spremembi statusa artikla
  if (body.status) {
    broadcastWS('ITEM_STATUS_CHANGED', {
      orderItemId: orderItem.id,
      orderId: orderItem.orderId,
      newStatus: body.status,
      menuItemName: orderItem.menuItem.name,
    })
  }

  return NextResponse.json(orderItem)
}
