
import { db } from '@/lib/db'
import { toNum, deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { getNextCounter } from '@/lib/counters'
import { requireAuth } from '@/lib/auth-middleware'
import { createOrderSchema } from '@/lib/validations'
import { checkStockAvailability } from '@/lib/stock-deduction'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { buildOrderItemsData, calculateOrderTotals, validateMenuItems, handleStockDeduction, handlePostCreationEffects } from './_helpers'

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
    const missingItem = validateMenuItems(data.orderItems, vatMap)
    if (missingItem) {
      return NextResponse.json(
        { error: `Artikel ${missingItem} ni najden` },
        { status: 400 }
      )
    }

    // ─── PREVERI RAZPOLŽLJIVOST ZALOGE (opozorilo, ne blokada) ───
    const stockCheck = await checkStockAvailability(
      data.orderItems.map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
      }))
    )

    // Izračun z multi-DDV po stopnjah (strežniška stran — edini vir resnice)
    const { orderItemsData, subtotal } = buildOrderItemsData(data.orderItems, vatMap, data.discount || 0)
    const { totalTax, totalDiscountAmount, total } = calculateOrderTotals(orderItemsData, subtotal)

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
            // OrderItemData matches unchecked create input
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          create: orderItemsData as any,
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
    const { stockDeducted } = await handleStockDeduction(
      order.id, order.orderNumber,
      data.orderItems.map(item => ({ menuItemId: item.menuItemId, quantity: item.quantity })),
    )

    // Sproži stranske učinke (WS, tisk, webhook, revizija)
    await handlePostCreationEffects(order, authResult.session?.employeeId, stockDeducted)

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
