// GET /api/kitchen/matrix — Matrični pregled aktivnih naročil po postajah
// Agregira OrderItem po menuItem.prepStationId — sešteje identične artikle
// v vseh aktivnih naročilih per postajo. Kuhar vidi npr. "skupaj na žaru: 14× pleskavica".
import { db } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'


export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // Pridobi vsa aktivna naročila z postavkami (brez voided/served/cancelled)
    const orders = await db.order.findMany({
      where: { status: { in: ['pending', 'in-progress', 'ready'] } },
      include: {
        orderItems: {
          where: {
            voided: false,
            status: { in: ['pending', 'fired', 'preparing', 'ready'] },
          },
          include: {
            menuItem: { include: { prepStation: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Agregiraj po postajah
    // stationMap: { stationId: { stationName, stationType, items: { menuItemId: { name, qty, orders: [] } } } }
    const stationMap: Record<string, {
      stationId: string
      stationName: string
      stationType: string
      items: Record<string, {
        menuItemId: string
        name: string
        totalQuantity: number
        orderCount: number
        orders: Array<{ orderNumber: number; quantity: number; status: string }>
      }>
    }> = {}

    for (const order of orders) {
      for (const oi of order.orderItems) {
        const station = oi.menuItem?.prepStation
        const stationId = station?.id || 'unassigned'
        const stationName = station?.name || 'Brez postaje'
        const stationType = station?.type || 'unknown'

        if (!stationMap[stationId]) {
          stationMap[stationId] = {
            stationId,
            stationName,
            stationType,
            items: {},
          }
        }

        const menuItemId = oi.menuItemId
        if (!stationMap[stationId].items[menuItemId]) {
          stationMap[stationId].items[menuItemId] = {
            menuItemId,
            name: oi.menuItem?.name || 'Neznan artikel',
            totalQuantity: 0,
            orderCount: 0,
            orders: [],
          }
        }

        stationMap[stationId].items[menuItemId].totalQuantity += oi.quantity
        stationMap[stationId].items[menuItemId].orderCount += 1
        stationMap[stationId].items[menuItemId].orders.push({
          orderNumber: order.orderNumber,
          quantity: oi.quantity,
          status: oi.status,
        })
      }
    }

    // Pretvori v array + dodaj skupne statuse
    const stations = Object.values(stationMap).map(station => {
      const items = Object.values(station.items).sort((a, b) => b.totalQuantity - a.totalQuantity)
      return {
        stationId: station.stationId,
        stationName: station.stationName,
        stationType: station.stationType,
        totalItems: items.reduce((s, i) => s + i.totalQuantity, 0),
        uniqueItems: items.length,
        items: items.map(item => ({
          ...item,
          // Status agregacija: če vse ready → ready, sicer preparing
          aggregateStatus: item.orders.every(o => o.status === 'ready')
            ? 'ready'
            : item.orders.some(o => o.status === 'preparing' || o.status === 'fired')
            ? 'preparing'
            : 'pending',
        })),
      }
    }).sort((a, b) => a.stationName.localeCompare(b.stationName))

    // Skupne statistike
    const stats = {
      totalStations: stations.length,
      totalActiveItems: stations.reduce((s, st) => s + st.totalItems, 0),
      totalUniqueItems: stations.reduce((s, st) => s + st.uniqueItems, 0),
      totalOrders: orders.length,
    }

    return NextResponse.json({ stations, stats })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/kitchen/matrix', 'Napaka pri matričnem pregledu')
  }
}
