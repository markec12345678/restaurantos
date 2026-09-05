
// POST /api/orders/[id]/add-items — Dodaj artikle k obstoječemu naročilu
import { db, createAuditLog } from '@/lib/db'
import { deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { addOrderItemsSchema } from '@/lib/validations'
import { deductStockForAddedItems, broadcastLowStockAlert } from '@/lib/stock-deduction'
import { handleRouteError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { createOrderItemsAndRecalculate } from './_helpers'


export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(addOrderItemsSchema, bodyResult.data)
    if (validationError) return validationError

    // Pridobi obstoječe naročilo
    // FIX P0-C1 (IDOR): findUnique → findFirst z locationId scope (cross-tenant zaščita)
    const sessionLocationId = authResult.session?.locationId ?? undefined
    const order = await db.order.findFirst({
      where: { id, ...(sessionLocationId ? { locationId: sessionLocationId } : {}) },
      include: { orderItems: { include: { menuItem: true } }, table: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
    }

    // FIX Test 6.3: Optimistic locking — preveri da order ni bil spremenjen
    if (data.expectedUpdatedAt) {
      const clientUpdatedAt = new Date(data.expectedUpdatedAt).getTime()
      const serverUpdatedAt = new Date(order.updatedAt).getTime()
      if (Math.abs(clientUpdatedAt - serverUpdatedAt) > 1000) {
        return NextResponse.json({
          error: 'Naročilo je bilo spremenjeno s strani drugega uporabnika. Osvežite in poskusite znova.',
          conflict: true,
          serverUpdatedAt: order.updatedAt.toISOString(),
          clientUpdatedAt: data.expectedUpdatedAt,
          currentStatus: order.status,
          currentPaymentStatus: order.paymentStatus,
        }, { status: 409 })
      }
    }

    if (order.status === 'completed' || order.status === 'cancelled') {
      return NextResponse.json({ error: 'Naročilo je že zaključeno ali preklicano' }, { status: 400 })
    }

    // FIX: Move order check INSIDE transaction to prevent TOCTOU race
    const newItems = await db.$transaction(async (tx) => {
      return createOrderItemsAndRecalculate(
        tx,
        id,
        data.orderItems,
      )
    })

    // ─── RAZKNJIŽI ZALOGO ZA NOVO DODANE ARTIKLE ───
    const stockResult = await deductStockForAddedItems(
      id,
      order.orderNumber,
      data.orderItems.map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
      }))
    )

    // Pošlji low-stock opozorila če so
    if (stockResult.lowStockAlerts.length > 0) {
      broadcastLowStockAlert(stockResult.lowStockAlerts)
    }

    // FIX: Broadcast to KDS/POS — kitchen needs to know about added items!
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`
      await fetch(`${appUrl}/api/ws-broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ORDER_UPDATED',
          payload: {
            orderId: id,
            orderNumber: order.orderNumber,
            action: 'add-items',
            addedCount: newItems.length,
          },
        }),
      })
    } catch {
      // WS ni na voljo — ni kritično
    }

    // Pridobi posodobljeno naročilo
    // FIX P0-C1 (IDOR): Tudi za vračanje posodobljenega naročila uporabi locationId scope
    const updatedOrder = await db.order.findFirst({
      where: { id, ...(sessionLocationId ? { locationId: sessionLocationId } : {}) },
      include: {
        table: true,
        orderItems: { include: { menuItem: true } },
      },
    })

    // Revizijski dnevnik
    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'ADD_ITEMS_TO_ORDER',
      entityType: 'Order',
      entityId: id,
      details: { orderNumber: order.orderNumber, addedCount: newItems.length, stockDeducted: stockResult.deducted.length },
    })

    return NextResponse.json(deepToNumbers({ order: updatedOrder, addedItems: newItems.length, _stockInfo: { deducted: stockResult.deducted.length, lowStockWarnings: stockResult.lowStockAlerts } }))
  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/orders/[id]/add-items', [
      { match: 'ni najden', substring: true, status: 400, message: error instanceof Error ? error.message : 'Ni najdeno' },
      { match: 'ni na voljo', substring: true, status: 400, message: error instanceof Error ? error.message : 'Ni na voljo' },
      { match: 'že zaključeno', substring: true, status: 400, message: error instanceof Error ? error.message : 'Že zaključeno' },
      { match: 'že preklicano', substring: true, status: 400, message: error instanceof Error ? error.message : 'Že preklicano' },
    ], 'Napaka pri dodajanju artiklov')
  }
}
