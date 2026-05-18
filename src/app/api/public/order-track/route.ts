import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// =====================================================================
// PUBLIC ORDER TRACKING — Sledenje statusu online naročila
// GET /api/public/order-track?orderId=xxx&phone=040123456
// Varnost: zahteva vsaj zadnje 4 številke telefona
// =====================================================================

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const orderId = url.searchParams.get('orderId')
    const orderNumber = url.searchParams.get('orderNumber')
    const phone = url.searchParams.get('phone')?.trim()

    if (!orderId && !orderNumber) {
      return NextResponse.json({ error: 'ID ali številka naročila je obvezna' }, { status: 400 })
    }

    if (!phone || phone.length < 4) {
      return NextResponse.json({ error: 'Telefonska številka je obvezna za sledenje' }, { status: 400 })
    }

    // Poišči naročilo
    const where: Record<string, unknown> = {}
    if (orderId) where.id = orderId
    if (orderNumber) where.orderNumber = parseInt(orderNumber) || 0

    const order = await db.order.findFirst({
      where,
      include: {
        orderItems: {
          include: { menuItem: { select: { name: true, image: true } } },
        },
        deliveryInfo: true,
        diningOption: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Naročilo ni bilo najdeno' }, { status: 404 })
    }

    // Preveri telefon (zadnje 4 števke)
    const orderPhone = (order.customerPhone || '').replace(/\s/g, '')
    const inputPhone = phone.replace(/\s/g, '')
    if (!orderPhone.endsWith(inputPhone.slice(-4)) && !inputPhone.endsWith(orderPhone.slice(-4))) {
      return NextResponse.json({ error: 'Napačna telefonska številka' }, { status: 403 })
    }

    // Status timeline
    const timeline: Array<{ status: string; label: string; time?: string; completed: boolean }> = []
    const statusOrder = ['pending', 'confirmed', 'in-progress', 'ready', 'delivered']
    const statusLabels: Record<string, string> = {
      'pending': 'Naročilo prejeto',
      'confirmed': 'Potrjeno',
      'in-progress': 'V pripravi',
      'ready': 'Pripravljeno',
      'delivered': 'Dostavljeno / Prevzeto',
      'cancelled': 'Preklicano',
    }

    if (order.status === 'cancelled') {
      timeline.push({ status: 'cancelled', label: 'Preklicano', completed: true, time: order.cancelledAt?.toISOString() })
    } else {
      const currentIdx = statusOrder.indexOf(order.status)
      for (let i = 0; i < statusOrder.length; i++) {
        timeline.push({
          status: statusOrder[i],
          label: statusLabels[statusOrder[i]] || statusOrder[i],
          completed: i <= currentIdx,
          time: i === currentIdx ? order.updatedAt.toISOString() : undefined,
        })
      }
    }

    return NextResponse.json({
      order: {
        id: order.id,
        orderNumber: String(order.orderNumber),
        status: order.status,
        type: order.type,
        customerName: order.customerName,
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        items: order.orderItems.map(item => ({
          name: item.menuItem?.name || 'Artikel',
          quantity: item.quantity,
          notes: item.notes,
        })),
        delivery: order.deliveryInfo ? {
          address: order.deliveryInfo.address,
          city: order.deliveryInfo.city,
          estimatedTime: order.deliveryInfo.estimatedTime?.toISOString(),
          status: order.deliveryInfo.status,
        } : null,
      },
      timeline,
      estimatedMinutes: order.type === 'delivery' ? 35 : 20,
    })
  } catch (error) {
    console.error('Order track error:', error)
    return NextResponse.json({ error: 'Napaka pri sledenju naročila' }, { status: 500 })
  }
}
