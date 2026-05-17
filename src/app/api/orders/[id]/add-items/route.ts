import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, addOrderItemsSchema } from '@/lib/validations'
import { deductStockForAddedItems, broadcastLowStockAlert } from '@/lib/stock-deduction'

// POST /api/orders/[id]/add-items — Dodaj artikle k obstoječemu naročilu
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(addOrderItemsSchema, body)
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

    // Dodaj nove artikle — vse v eni transakciji
    const newItems = await db.$transaction(async (tx) => {
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
        const vatRate = menuItem.vatRate
        const serverPrice = menuItem.price // Strežniška cena — edini vir resnice
        const itemBase = serverPrice * item.quantity
        const vatAmount = itemBase * (vatRate / 100)

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
            discountAmount: order.discount > 0 && order.subtotal > 0
              ? Math.round((serverPrice * item.quantity / order.subtotal) * order.discount * 100) / 100
              : 0,
          },
          include: { menuItem: true },
        })
        created.push(orderItem)
      }

      // Preračunaj skupne zneske s per-item DDV (strežniško)
      const allItems = [...order.orderItems, ...created]
      const subtotal = allItems.reduce((sum, oi) => sum + oi.price * oi.quantity, 0)
      // FIX HIGH: Use existing vatAmount for old items instead of recalculating — 
      // old items may have discount-adjusted VAT amounts
      const tax = allItems.reduce((sum, oi) => {
        if ('vatAmount' in oi && oi.vatAmount > 0) {
          // Existing item — use pre-calculated VAT (may include discount adjustments)
          return sum + oi.vatAmount
        }
        // New item — calculate VAT
        const rate = oi.vatRate ?? 22.0
        return sum + oi.price * oi.quantity * (rate / 100)
      }, 0)
      // FIX H-03: Popust ostaja nespremenjen, ponovno preveri cap
      const discount = Math.min(order.discount, subtotal)
      const total = subtotal + tax - discount
      const totalWithTip = total + (order.tip || 0)

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

    return NextResponse.json({ order: updatedOrder, addedItems: newItems.length, _stockInfo: { deducted: stockResult.deducted.length, lowStockWarnings: stockResult.lowStockAlerts } })
  } catch (error) {
    console.error('Add items error:', error)
    const message = error instanceof Error ? error.message : 'Napaka pri dodajanju artiklov'
    // FIX BUG: Napake iz transakcije (artikel ni najden, itd.) so client errors (400), ne server errors (500)
    const isClientError = error instanceof Error && (
      message.includes('ni najden') ||
      message.includes('ni na voljo') ||
      message.includes('že zaključeno') ||
      message.includes('že preklicano')
    )
    return NextResponse.json({ error: message }, { status: isClientError ? 400 : 500 })
  }
}
