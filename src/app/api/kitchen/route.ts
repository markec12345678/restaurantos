import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

// GET /api/kitchen — Active orders for kitchen display
export async function GET(req: Request) {
  try {
    // AVTENTIKACIJA: Kuhinja mora biti zaščitena
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX MEDIUM: Paginacija za KDS — prepreči nalaganje preveč naročil
    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

    const orders = await db.order.findMany({
      where: {
        status: { in: ['pending', 'in-progress'] },
      },
      orderBy: [
        { status: 'asc' },  // pending first
        { createdAt: 'asc' },  // oldest first
      ],
      take: limit,
      include: {
        table: true,
        orderItems: {
          include: { menuItem: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    // Calculate wait times and urgency
    const now = new Date()
    const enrichedOrders = orders.map(order => {
      const waitMs = now.getTime() - new Date(order.createdAt).getTime()
      const waitMinutes = Math.floor(waitMs / 60000)

      // Determine urgency level
      let urgency: 'normal' | 'warning' | 'critical' = 'normal'
      if (waitMinutes >= 20) urgency = 'critical'
      else if (waitMinutes >= 10) urgency = 'warning'

      // Count items by status
      const pendingCount = order.orderItems.filter(oi => oi.status === 'pending').length
      const preparingCount = order.orderItems.filter(oi => oi.status === 'preparing').length
      const readyCount = order.orderItems.filter(oi => oi.status === 'ready').length

      return {
        ...order,
        waitMinutes,
        urgency,
        pendingCount,
        preparingCount,
        readyCount,
        totalItems: order.orderItems.length,
      }
    })

    // Summary stats
    const stats = {
      totalActive: orders.length,
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      inProgressOrders: orders.filter(o => o.status === 'in-progress').length,
      totalItemsPending: orders.reduce((sum, o) => sum + o.orderItems.filter(oi => oi.status === 'pending').length, 0),
      totalItemsPreparing: orders.reduce((sum, o) => sum + o.orderItems.filter(oi => oi.status === 'preparing').length, 0),
      totalItemsReady: orders.reduce((sum, o) => sum + o.orderItems.filter(oi => oi.status === 'ready').length, 0),
      avgWaitTime: orders.length > 0
        ? Math.round(enrichedOrders.reduce((sum, o) => sum + o.waitMinutes, 0) / orders.length)
        : 0,
      criticalOrders: enrichedOrders.filter(o => o.urgency === 'critical').length,
    }

    return NextResponse.json({ orders: enrichedOrders, stats })
  } catch (error) {
    console.error('Kitchen GET error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju kuhinjskih naročil' }, { status: 500 })
  }
}
