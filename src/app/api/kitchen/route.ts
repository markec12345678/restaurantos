import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth } from '@/lib/auth-middleware'

import { handleApiError, parsePaginationParams } from '@/lib/api-utils'

// GET /api/kitchen — Active orders for kitchen display
export const dynamic = 'force-dynamic'
// FIX NAPAKA 5 (HTTP 503): Kitchen z orderItems + menuItem include je lahko počasen.
export const maxDuration = 30

export async function GET(req: Request) {
  try {
    // AVTENTIKACIJA: Kuhinja mora biti zaščitena
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX MEDIUM: Paginacija za KDS — prepreči nalaganje preveč naročil
    const { searchParams } = new URL(req.url)
    // P1-16: centralna pagination validacija (limit max, search dolžina)
    const { limit } = parsePaginationParams(searchParams, { defaultLimit: 50 })

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
          include: {
            menuItem: {
              include: {
                prepStation: { select: { id: true, name: true, type: true } },
                category: { select: { id: true, name: true, menu: { select: { id: true, name: true } } } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    // Calculate wait times and urgency (DELJENO za obe množici)
    const now = new Date()
    const enrichOrder = (
      order: (typeof orders)[number]
    ): (typeof orders)[number] & {
      waitMinutes: number
      urgency: 'normal' | 'warning' | 'critical'
      pendingCount: number
      preparingCount: number
      readyCount: number
      totalItems: number
    } => {
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
    }

    const enrichedOrders = orders.map(enrichOrder)

    // R26-b (Toast vzorec): "pick-up shelf" — naročila statusa 'ready' ostanejo
    // VIDNA na KDS, dokler kuhar/jata ne Bump-a (bump je čisto odjemalska
    // display akcija — bumped-store.ts; zaključek ostane naloga natakarja).
    const readyRaw = await db.order.findMany({
      where: { status: 'ready' },
      orderBy: { createdAt: 'asc' },
      take: 10,
      include: {
        table: true,
        orderItems: {
          include: {
            menuItem: {
              include: {
                prepStation: { select: { id: true, name: true, type: true } },
                category: { select: { id: true, name: true, menu: { select: { id: true, name: true } } } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    const readyOrders = readyRaw.map(enrichOrder)

    // Summary stats
    const stats = {
      totalActive: orders.length + readyOrders.length,
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      inProgressOrders: orders.filter(o => o.status === 'in-progress').length,
      readyOrdersCount: readyOrders.length,
      totalItemsPending: orders.reduce((sum, o) => sum + o.orderItems.filter(oi => oi.status === 'pending').length, 0),
      totalItemsPreparing: orders.reduce((sum, o) => sum + o.orderItems.filter(oi => oi.status === 'preparing').length, 0),
      totalItemsReady: orders.reduce((sum, o) => sum + o.orderItems.filter(oi => oi.status === 'ready').length, 0),
      avgWaitTime: orders.length > 0
        ? Math.round(enrichedOrders.reduce((sum, o) => sum + o.waitMinutes, 0) / orders.length)
        : 0,
      criticalOrders: enrichedOrders.filter(o => o.urgency === 'critical').length,
    }

    return NextResponse.json({ orders: enrichedOrders, readyOrders, stats })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/kitchen', 'Napaka pri pridobivanju kuhinjskih naročil')
  }
}
