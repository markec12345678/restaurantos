
// Helper za WebSocket broadcast (varen klic — deluje tudi brez WS strežnika)
import { db, createAuditLog } from '@/lib/db'
import { toNum, round2, deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { getNextCounter } from '@/lib/counters'
import { requireAuth } from '@/lib/auth-middleware'
import { createOrderSchema } from '@/lib/validations'
import { checkStockAvailability, deductStockForOrder, broadcastLowStockAlert } from '@/lib/stock-deduction'
import { getAppUrl } from '@/lib/utils'
import { emitOrderCreated } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleApiError, validateRequest } from '@/lib/api-utils'
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
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('orders', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

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
    return NextResponse.json({ orders: deepToNumbers(orders), total, limit, offset })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/orders', 'Napaka pri pridobivanju naročil')
  }
}

export async function POST(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('orders', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    // FIX C-05: Zahtevaj avtentikacijo za ustvarjanje naročil
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX H-01: Validiraj vnos z Zod + omejitev velikosti bodyja (1 MB) + samodejna sanatizacija
    const { data, error: validationError } = await validateRequest(req, createOrderSchema, { maxBodySize: 1024 * 1024 })
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
      const vatRate = toNum(mi.vatRate)
      const price = toNum(mi.price) // FIX C-02: Strežniška cena iz baze — edini vir resnice
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
          // FIX M-02: Prepreči negativen popust — Math.max(0, ...) prepreči, da zaokroževanje
          // ustvari negativen preostali popust, kar bi povečalo ceno zadnjega artikla
          itemDiscount = Math.max(0, remainingDiscount)
        } else {
          itemDiscount = Math.round((item.itemBase / subtotal) * discount * 100) / 100
        }
        discountDistributed += itemDiscount
      }

      const adjustedBase = item.itemBase - itemDiscount
      // FIX BUG: Zaokroži vatAmount na 2 decimalni mesti — prepreči float napake v valuti
      const adjustedVat = Math.round(adjustedBase * (item.vatRate / 100) * 100) / 100

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
    subtotal = orderItemsData.reduce((sum, item) => sum + toNum(item.price) * item.quantity, 0)
    const totalTax = round2(orderItemsData.reduce((sum, item) => sum + toNum(item.vatAmount), 0))
    const totalDiscountAmount = round2(orderItemsData.reduce((sum, item) => sum + toNum(item.discountAmount), 0))
    const total = round2(subtotal + totalTax - totalDiscountAmount)

    // FIX BUG-02: Ustvari naročilo in posodobi mizo v eni transakciji
    const order = await db.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          type: data.type,
          status: 'pending',
          tableId: data.tableId || null,
          diningOptionId: data.diningOptionId || null,
          revenueCenterId: data.revenueCenterId || null,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail || '', // FIX MEDIUM: Shrani e-pošto stranke
          subtotal,
          tax: totalTax,
          discount: totalDiscountAmount,
          total,
          tip: toNum(data.tip),
          totalWithTip: total + toNum(data.tip),
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

      // Posodobi mizo znotraj transakcije
      if (data.tableId && data.type === 'dine-in') {
        await tx.table.update({ where: { id: data.tableId }, data: { status: 'occupied' } })
      }

      return newOrder
    })

    // ─── SAMODEJNO RAZKNJIŽEVANJE ZALOGE OB ODDAJI NAROČILA ───
    // FIX BUG-02: Poskusi razknjižiti zalogo takoj; če ne uspe, bo order.inventoryDeducted=false
    // in ozadnski proces lahko poskusi znova
    let stockDeducted = false
    try {
      const stockResult = await deductStockForOrder(
        order.id,
        order.orderNumber,
        data.orderItems.map(item => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
        }))
      )
      stockDeducted = true

      // Označi naročilo kot razknjiženo
      await db.order.update({
        where: { id: order.id },
        data: { inventoryDeducted: true },
      })

      // Pošlji low-stock opozorila če so
      if (stockResult.lowStockAlerts.length > 0) {
        broadcastLowStockAlert(stockResult.lowStockAlerts)
      }
    } catch (stockError: unknown) {
      logger.error('API', `[STOCK] Napaka pri razknjiževanju zaloge za naročilo ${order.orderNumber}`, stockError)
      // Naročilo je ustvarjeno, vendar zaloga NI razknjižena
      // inventoryDeducted ostane false — ozadnski proces bo poskusil znova
    }

    // WebSocket: obvesti KDS o novem naročilu
    broadcastWS('NEW_ORDER', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      type: order.type,
      tableId: order.tableId,
      total: toNum(order.total),
    })

    // Samodejni tisk kuhinjskega naročila (v ozadju)
    autoPrintKitchenOrder(order as unknown as Record<string, unknown>)

    // Webhook/integracija: sproži order.created dogodek
    emitOrderCreated({
      orderId: order.id,
      orderNumber: order.orderNumber,
      type: order.type,
      tableId: order.tableId || undefined,
      total: toNum(order.total),
    }).catch(err => logger.error('API', '[Webhook] order.created napaka:', err))

    // Revizijski dnevnik: novo naročilo
    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'CREATE_ORDER',
      entityType: 'Order',
      entityId: order.id,
      details: { orderNumber: order.orderNumber, total: toNum(order.total), type: order.type, tableId: order.tableId, inventoryDeducted: stockDeducted },
    })

    // Vrni naročilo z informacijami o zalogi
    return NextResponse.json(deepToNumbers({
      ...order,
      _stockInfo: {
        deducted: stockDeducted,
        lowStockWarnings: stockCheck.warnings,
        stockUnavailable: stockCheck.warnings,
      },
    }), { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/orders', 'Napaka pri ustvarjanju naročila')
  }
}
