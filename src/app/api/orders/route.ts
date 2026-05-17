import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getNextCounter } from '@/lib/counters'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, createOrderSchema } from '@/lib/validations'
import { checkStockAvailability, deductStockForOrder, broadcastLowStockAlert } from '@/lib/stock-deduction'
import { getAppUrl } from '@/lib/utils'

// Helper za WebSocket broadcast (varen klic — deluje tudi brez WS strežnika)
async function broadcastWS(type: string, payload: unknown) {
  try {
    await fetch(`${getAppUrl()}/api/ws-broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    })
  } catch {
    // WS strežnik ni na voljo — tiho prezri
  }
}

// Helper za samodejni tisk kuhinjskega naročila
async function autoPrintKitchenOrder(order: Record<string, unknown>) {
  try {
    await fetch(`${getAppUrl()}/api/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'order', orderId: order.id }),
    })
  } catch {
    // Tiskanje ni na voljo — tiho prezri
  }
}

export async function GET(req: Request) {
  try {
    // FIX HIGH: Zahtevaj avtentikacijo — tudi KDS mora imeti veljaven token
    // Za javne podatke (QR naročanje) uporabljajte /api/public/* rute
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const paymentStatus = searchParams.get('paymentStatus')
    // FIX: Paginacija — prepreči nalaganje 100.000+ zapisov
    // FIX HIGH: parseInt lahko vrne NaN — uporabi varno parsanje z fallbackom
    const rawLimit = parseInt(searchParams.get('limit') || '100')
    const rawOffset = parseInt(searchParams.get('offset') || '0')
    const limit = Math.min(Number.isNaN(rawLimit) ? 100 : rawLimit, 500)
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (type) where.type = type
    if (paymentStatus) where.paymentStatus = paymentStatus

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          table: true,
          orderItems: { include: { menuItem: true } },
        },
      }),
      db.order.count({ where }),
    ])
    return NextResponse.json({ orders, total, limit, offset })
  } catch (error) {
    console.error('Napaka pri pridobivanju naročil:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju naročil' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    // FIX C-05: Zahtevaj avtentikacijo za ustvarjanje naročil
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(createOrderSchema, body)
    if (validationError) return validationError

    // FIX 1: Atomic counter — prepreči race condition
    const orderNumber = await getNextCounter('orderNumber')

    // Multi-DDV: pridobi vatRate za vsak artiklov iz baze (edini vir resnice)
    const menuItemIds = data.orderItems.map(item => item.menuItemId)
    const menuItems = await db.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: { id: true, vatRate: true, price: true },
    })
    const vatMap = new Map(menuItems.map(mi => [mi.id, mi]))
    
    // Preveri, da vsi artikli obstajajo
    for (const item of data.orderItems) {
      if (!vatMap.has(item.menuItemId)) {
        return NextResponse.json(
          { error: `Artikel ${item.menuItemId} ni najden` },
          { status: 400 }
        )
      }
    }

    // ─── PREVERI RAZPOLŽLJIVOST ZALOGE (opozorilo, ne blokada) ───
    const stockCheck = await checkStockAvailability(
      data.orderItems.map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
      }))
    )

    // Izračun z multi-DDV po stopnjah (strežniška stran — edini vir resnice)
    // FIX MEDIUM: Popust proporcionalno zmanjša DDV baze po stopnjah (FURS skladno)
    let subtotal = 0
    const rawItemsData = data.orderItems.map(item => {
      const mi = vatMap.get(item.menuItemId)!
      const vatRate = mi.vatRate
      const price = mi.price // FIX C-02: Strežniška cena iz baze — edini vir resnice
      const itemBase = price * item.quantity
      subtotal += itemBase
      return { menuItemId: item.menuItemId, quantity: item.quantity, price, vatRate, itemBase }
    })

    // FIX H-03: Popust ne more preseči vmesne vsote
    const discount = Math.min(data.discount || 0, subtotal)

    // Porazdeli popust proporcionalno po artiklih
    let discountDistributed = 0
    const orderItemsData = rawItemsData.map((item, idx) => {
      let itemDiscount = 0
      if (discount > 0 && subtotal > 0) {
        const remainingDiscount = discount - discountDistributed
        if (idx === rawItemsData.length - 1) {
          itemDiscount = remainingDiscount
        } else {
          itemDiscount = Math.round((item.itemBase / subtotal) * discount * 100) / 100
        }
        discountDistributed += itemDiscount
      }

      const adjustedBase = item.itemBase - itemDiscount
      const adjustedVat = adjustedBase * (item.vatRate / 100)

      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: item.price,
        vatRate: item.vatRate,
        vatAmount: adjustedVat,
        discountAmount: itemDiscount,
        notes: data.orderItems[idx].notes,
        modifiersJson: data.orderItems[idx].modifiersJson,
        status: 'pending' as const,
      }
    })

    // Ponovno izračunaj subtotale in davke z upoštevanjem popustov
    // FIX MEDIUM: Zaokroži vse zneske na 2 decimalni mesti — prepreči floating-point napake pri valuti
    subtotal = orderItemsData.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const totalTax = Math.round(orderItemsData.reduce((sum, item) => sum + item.vatAmount, 0) * 100) / 100
    const totalDiscountAmount = Math.round(orderItemsData.reduce((sum, item) => sum + item.discountAmount, 0) * 100) / 100
    const total = Math.round((subtotal + totalTax - totalDiscountAmount) * 100) / 100

    const order = await db.order.create({
      data: {
        orderNumber,
        type: data.type,
        status: 'pending',
        tableId: data.tableId || null,
        diningOptionId: data.diningOptionId || null,
        revenueCenterId: data.revenueCenterId || null,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        subtotal,
        tax: totalTax,
        discount: totalDiscountAmount,
        total,
        tip: data.tip || 0,
        totalWithTip: total + (data.tip || 0),
        paymentStatus: 'unpaid',
        paymentMethod: '',
        notes: data.notes,
        employeeId: data.employeeId || authResult.session?.employeeId || null,
        inventoryDeducted: false,
        orderItems: {
          create: orderItemsData,
        },
      },
      include: {
        table: true,
        orderItems: { include: { menuItem: true } },
      },
    })

    if (data.tableId && data.type === 'dine-in') {
      await db.table.update({ where: { id: data.tableId }, data: { status: 'occupied' } })
    }

    // ─── SAMODEJNO RAZKNJIŽEVANJE ZALOGE OB ODDAJI NAROČILA ───
    // Zaloga se odbije TAKOJ ko se naročilo ustvari (ne šele ob zaključku!)
    // To je pravilnejše za real-time sledenje zaloge
    const stockResult = await deductStockForOrder(
      order.id,
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

    // WebSocket: obvesti KDS o novem naročilu
    broadcastWS('NEW_ORDER', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      type: order.type,
      tableId: order.tableId,
      total: order.total,
    })

    // Samodejni tisk kuhinjskega naročila (v ozadju)
    autoPrintKitchenOrder(order as unknown as Record<string, unknown>)

    // Revizijski dnevnik: novo naročilo
    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'CREATE_ORDER',
      entityType: 'Order',
      entityId: order.id,
      details: { orderNumber: order.orderNumber, total: order.total, type: order.type, tableId: order.tableId, stockDeducted: stockResult.deducted.length, lowStockWarnings: stockResult.lowStockAlerts.length },
    })

    // Vrni naročilo z informacijami o zalogi
    return NextResponse.json({
      ...order,
      _stockInfo: {
        deducted: stockResult.deducted.length,
        lowStockWarnings: stockResult.lowStockAlerts,
        stockUnavailable: stockCheck.warnings,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Napaka pri ustvarjanju naročila:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju naročila' }, { status: 500 })
  }
}
