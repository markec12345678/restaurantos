
// POST /api/orders/[id]/add-items — Dodaj artikle k obstoječemu naročilu
import { db, createAuditLog } from '@/lib/db'
import { toNum, round2, isPositive, deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { addOrderItemsSchema } from '@/lib/validations'
import { deductStockForAddedItems, broadcastLowStockAlert } from '@/lib/stock-deduction'
import { handleRouteError, parseJsonBody, validateBody } from '@/lib/api-utils'
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

    // FIX: Move order check INSIDE transaction to prevent TOCTOU race
    // (order could be cancelled between read and transaction start)
    const newItems = await db.$transaction(async (tx) => {
      // Re-read order inside transaction for consistent state
      const currentOrder = await tx.order.findUnique({
        where: { id },
        include: { orderItems: { include: { menuItem: true } }, table: true },
      })

      if (!currentOrder) {
        throw new Error('Naročilo ni najdeno')
      }

      if (currentOrder.status === 'completed' || currentOrder.status === 'cancelled') {
        throw new Error('Naročilo je že zaključeno ali preklicano')
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma OrderItem & { menuItem } from include
      const created: any[] = []

      // Preveri, da vsi artikli obstajajo
      for (const item of data.orderItems) {
        const menuItem = await tx.menuItem.findUnique({ where: { id: item.menuItemId } })
        if (!menuItem) {
          throw new Error(`Artikel ${item.menuItemId} ni najden`)
        }
      }

      for (const item of data.orderItems) {
        // Pridobi artikel za DDV stopnjo in CENO (strežniško — edini vir resnice)
        // FIX BUG 6: Uporabimo menuItem.price iz baze, NE client-sent item.price
        // To prepreči manipulacijo cen s strani klienta
        const menuItem = (await tx.menuItem.findUnique({ where: { id: item.menuItemId } }))!
        const vatRate = toNum(menuItem.vatRate)
        const serverPrice = toNum(menuItem.price) // Strežniška cena — edini vir resnice
        const itemBase = serverPrice * item.quantity
        const vatAmount = round2(itemBase * (vatRate / 100))

        const orderItem = await tx.orderItem.create({
          data: {
            orderId: id,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            price: serverPrice, // FIX: Strežniška cena, ne client-sent
            notes: item.notes,
            modifiersJson: item.modifiersJson,
            status: 'pending',
            vatRate,
            vatAmount,
            // FIX BUG: Podeduj discountAmount proporcionalno od starševskega naročila
            // Novi artikli dobijo sorazmeren del popusta glede na svojo ceno
            discountAmount: isPositive(order.discount) && isPositive(order.subtotal)
              ? round2(serverPrice * item.quantity / toNum(order.subtotal) * toNum(order.discount))
              : 0,
          },
          include: { menuItem: true },
        })
        created.push(orderItem)
      }

      // Use currentOrder (from within transaction) instead of stale order
      const allItems = [...currentOrder.orderItems, ...created]
      const subtotal = allItems.reduce((sum, oi) => sum + toNum(oi.price) * oi.quantity, 0)
      // FIX HIGH: Use existing vatAmount for old items instead of recalculating — 
      // old items may have discount-adjusted VAT amounts
      const tax = allItems.reduce((sum, oi) => {
        if ('vatAmount' in oi && toNum(oi.vatAmount) > 0) {
          // Existing item — use pre-calculated VAT (may include discount adjustments)
          return sum + toNum(oi.vatAmount)
        }
        // New item — calculate VAT
        const rate = oi.vatRate != null ? toNum(oi.vatRate) : 22.0
        return sum + toNum(oi.price) * oi.quantity * (rate / 100)
      }, 0)
      // FIX HIGH: Recalculate discount across ALL items (old + new) proportionally
      const discount = Math.min(toNum(currentOrder.discount), subtotal)
      const total = round2(subtotal + tax - discount)
      const totalWithTip = round2(total + toNum(currentOrder.tip)) // FIX: Use currentOrder.tip (inside tx) not stale order.tip

      await tx.order.update({
        where: { id },
        data: { subtotal, tax, discount, total, totalWithTip },
      })

      return created
    })

    // ─── RAZKNJIŽI ZALOGO ZA NOVO DODANE ARTIKLE ───
    // Ker je naročilo že obstojalo (inventoryDeducted je morda že true),
    // razknjižimo SAMO nove artikle — ne celotnega naročila znova!
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
    const updatedOrder = await db.order.findUnique({
      where: { id },
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
