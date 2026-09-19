// ============================================
// GET /api/operational-alerts — Operational Red Flags Dashboard
// ============================================
// URY Mosaic-style: real-time operational alerts across the restaurant.
// Detects: delayed orders, KOT not started, unclosed bills, excessive cancellations,
// low stock, pending FURS, staff issues.
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'

import { formatEUR } from '@/lib/safe-format'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)

    // R80 FIX HIGH (aggregate leak): celoten GET je bil brez lokacijskega filtra —
    // naročila (številke/zneski tujih miz), nefiskalizirani računi, odprte izmene
    // (startingCash) in zaloga VSEH tenantov (view_reports dosegljiv managerjem).
    // Fail-closed za regular uporabnika brez lokacije. Order/Receipt/
    // InventoryItem/Table/CashRegisterShift imajo lasten locationId; OrderItem
    // NIMA — tenant pot gre prek relacije order.locationId.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/operational-alerts',
    })
    if ('error' in scope) return scope.error

    // null scope (super-admin) = PRAZEN filter — NIKOLI { locationId: null }
    const locFilter = scope.locationId ? { locationId: scope.locationId } : {}

    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // ═══════════════════════════════════════════════════════════════
    // 1. ZAKASNELA NAROČILA (firedAt > 15 min ago, še ni ready/served)
    // ═══════════════════════════════════════════════════════════════
    const delayedOrders = await db.order.findMany({
      where: {
        status: { in: ['in-progress', 'pending'] },
        firedAt: { lt: new Date(now.getTime() - 15 * 60 * 1000) },
        ...locFilter,
      },
      include: {
        table: { select: { number: true } },
        orderItems: { select: { id: true, status: true, menuItemName: true } },
      },
      orderBy: { firedAt: 'asc' },
      take: 20,
    })

    const delayedOrderAlerts = delayedOrders.map(o => {
      const firedAt = o.firedAt ? new Date(o.firedAt) : null
      const elapsedMin = firedAt ? Math.floor((now.getTime() - firedAt.getTime()) / 60000) : 0
      return {
        type: 'delayed_order',
        severity: elapsedMin > 30 ? 'critical' : elapsedMin > 20 ? 'warning' : 'info',
        orderId: o.id,
        orderNumber: o.orderNumber,
        tableNumber: o.table?.number || null,
        elapsedMinutes: elapsedMin,
        itemCount: o.orderItems.filter(i => !['served', 'cancelled'].includes(i.status)).length,
        message: `Naročilo #${o.orderNumber} čaka ${elapsedMin} minut`,
      }
    })

    // ═══════════════════════════════════════════════════════════════
    // 2. KOT NI ZAČET (order fired ampak noben item ni 'preparing' ali 'ready')
    // ═══════════════════════════════════════════════════════════════
    const kotNotStarted = await db.order.findMany({
      where: {
        status: 'in-progress',
        firedAt: { lt: new Date(now.getTime() - 5 * 60 * 1000) },
        orderItems: { every: { status: 'pending' } },
        ...locFilter,
      },
      include: { table: { select: { number: true } } },
      take: 10,
    })

    const kotAlerts = kotNotStarted.map(o => ({
      type: 'kot_not_started',
      severity: 'warning',
      orderId: o.id,
      orderNumber: o.orderNumber,
      tableNumber: o.table?.number || null,
      message: `KOT #${o.orderNumber} ni začet v kuhinji`,
    }))

    // ═══════════════════════════════════════════════════════════════
    // 3. NEODPRTI RAČUNI (orders z paymentStatus=unpaid starejši od 2 uri)
    // ═══════════════════════════════════════════════════════════════
    const unclosedBills = await db.order.findMany({
      where: {
        paymentStatus: 'unpaid',
        status: { in: ['ready', 'in-progress'] },
        createdAt: { lt: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
        ...locFilter,
      },
      include: { table: { select: { number: true } } },
      take: 15,
    })

    const unclosedAlerts = unclosedBills.map(o => {
      const createdAt = new Date(o.createdAt)
      const hoursOpen = Math.floor((now.getTime() - createdAt.getTime()) / (60 * 60 * 1000))
      return {
        type: 'unclosed_bill',
        severity: hoursOpen > 4 ? 'critical' : 'warning',
        orderId: o.id,
        orderNumber: o.orderNumber,
        tableNumber: o.table?.number || null,
        hoursOpen,
        total: toNum(o.total),
        message: `Miza ${o.table?.number || '?'} odprta ${hoursOpen}h (${formatEUR(toNum(o.total).toFixed(2))})`,
      }
    })

    // ═══════════════════════════════════════════════════════════════
    // 4. PREVEČ PREKLICOV (več kot 3 preklici danes)
    // ═══════════════════════════════════════════════════════════════
    const cancelledToday = await db.order.count({
      where: {
        status: 'cancelled',
        cancelledAt: { gte: todayStart },
        ...locFilter,
      },
    })

    const cancelledItemsToday = await db.orderItem.count({
      where: {
        status: 'cancelled',
        createdAt: { gte: todayStart },
        // R80: OrderItem nima locationId — scope prek relacije order.locationId
        order: { ...locFilter },
      },
    })

    const cancellationAlerts: Array<Record<string, unknown>> = []
    if (cancelledToday >= 5) {
      cancellationAlerts.push({
        type: 'excessive_cancellations',
        severity: cancelledToday >= 10 ? 'critical' : 'warning',
        count: cancelledToday,
        itemCount: cancelledItemsToday,
        message: `${cancelledToday} preklicanih naročil danes (${cancelledItemsToday} artiklov)`,
      })
    }

    // ═══════════════════════════════════════════════════════════════
    // 5. NIZKA ZALOGA
    // ═══════════════════════════════════════════════════════════════
    const lowStockItems = await db.inventoryItem.findMany({
      where: {
        quantity: { lte: db.inventoryItem.fields.minQuantity },
        ...locFilter,
      },
      select: { id: true, name: true, quantity: true, minQuantity: true, unit: true },
      take: 20,
    })

    const stockAlerts = lowStockItems.map(i => ({
      type: 'low_stock',
      severity: toNum(i.quantity) <= 0 ? 'critical' : 'warning',
      itemId: i.id,
      itemName: i.name,
      currentQty: toNum(i.quantity),
      minQty: toNum(i.minQuantity),
      unit: i.unit,
      message: toNum(i.quantity) <= 0
        ? `${i.name} — NI NA ZALOGI`
        : `${i.name} — ${toNum(i.quantity)}${i.unit} (min: ${toNum(i.minQuantity)})`,
    }))

    // ═══════════════════════════════════════════════════════════════
    // 6. NEFISKALIZIRANI RAČUNI (starejši od 1 ure)
    // ═══════════════════════════════════════════════════════════════
    const unfiscalizedReceipts = await db.receipt.count({
      where: {
        fiscalVerified: false,
        isStorno: false,
        createdAt: { lt: oneHourAgo },
        ...locFilter,
      },
    })

    const fursAlerts: Array<Record<string, unknown>> = []
    if (unfiscalizedReceipts > 0) {
      fursAlerts.push({
        type: 'unfiscalized_receipts',
        severity: unfiscalizedReceipts > 5 ? 'critical' : 'warning',
        count: unfiscalizedReceipts,
        message: `${unfiscalizedReceipts} računov brez FURS overitve (starejših od 1h)`,
      })
    }

    // ═══════════════════════════════════════════════════════════════
    // 7. ODPRTE IZMENE (če je odprta izmena starejša od 12h)
    // ═══════════════════════════════════════════════════════════════
    const openShifts = await db.cashRegisterShift.findMany({
      where: {
        status: 'open',
        openedAt: { lt: new Date(now.getTime() - 12 * 60 * 60 * 1000) },
        ...locFilter,
      },
      select: { id: true, openedAt: true, startingCash: true },
      take: 5,
    })

    const shiftAlerts = openShifts.map(s => {
      const hoursOpen = Math.floor((now.getTime() - new Date(s.openedAt).getTime()) / (60 * 60 * 1000))
      return {
        type: 'shift_too_long',
        severity: hoursOpen > 16 ? 'critical' : 'warning',
        shiftId: s.id,
        hoursOpen,
        startingCash: toNum(s.startingCash),
        message: `Izmena odprta ${hoursOpen}h (preko 12h limita)`,
      }
    })

    // ═══════════════════════════════════════════════════════════════
    // 8. POVEČANA MIZA (table occupied > 3h)
    // ═══════════════════════════════════════════════════════════════
    const longOccupiedTables = await db.table.findMany({
      where: {
        status: 'occupied',
        ...locFilter,
        orders: {
          some: {
            status: { in: ['pending', 'in-progress', 'ready'] },
            paymentStatus: 'unpaid',
            createdAt: { lt: new Date(now.getTime() - 3 * 60 * 60 * 1000) },
          },
        },
      },
      select: { id: true, number: true, capacity: true },
      take: 10,
    })

    const tableAlerts = longOccupiedTables.map(t => ({
      type: 'table_long_occupied',
      severity: 'info',
      tableId: t.id,
      tableNumber: t.number,
      capacity: t.capacity,
      message: `Miza ${t.number} zasedena >3h`,
    }))

    // ═══════════════════════════════════════════════════════════════
    // ZDRUŽI VSE ALERT-e
    // ═══════════════════════════════════════════════════════════════
    const allAlerts = [
      ...delayedOrderAlerts,
      ...kotAlerts,
      ...unclosedAlerts,
      ...cancellationAlerts,
      ...stockAlerts,
      ...fursAlerts,
      ...shiftAlerts,
      ...tableAlerts,
    ].sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 }
      return (severityOrder[a.severity as keyof typeof severityOrder] || 3)
           - (severityOrder[b.severity as keyof typeof severityOrder] || 3)
    })

    const summary = {
      total: allAlerts.length,
      critical: allAlerts.filter(a => a.severity === 'critical').length,
      warning: allAlerts.filter(a => a.severity === 'warning').length,
      info: allAlerts.filter(a => a.severity === 'info').length,
    }

    return NextResponse.json({
      timestamp: now.toISOString(),
      summary,
      alerts: allAlerts,
      categories: {
        delayedOrders: delayedOrderAlerts.length,
        kotNotStarted: kotAlerts.length,
        unclosedBills: unclosedAlerts.length,
        cancellations: cancellationAlerts.length,
        lowStock: stockAlerts.length,
        unfiscalized: fursAlerts.length,
        longShifts: shiftAlerts.length,
        longOccupiedTables: tableAlerts.length,
      },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/operational-alerts', 'Napaka pri pridobivanju operativnih alertov')
  }
}
