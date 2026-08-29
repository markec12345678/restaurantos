// POST handler logika za orders API — ustvarjanje naročila

import { db } from '@/lib/db'
import { toNum, deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { getNextCounter } from '@/lib/counters'
import { createOrderSchema } from '@/lib/validations'
import { checkStockAvailability } from '@/lib/stock-deduction'
import { validateRequest } from '@/lib/api-utils'
import { buildOrderItemsData, calculateOrderTotals, validateMenuItems } from './order-items'
import { handleStockDeduction, handlePostCreationEffects } from './stock'

export async function handlePostOrder(
  req: Request,
  authSession: { session?: { employeeId?: string } | null },
) {
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
        employeeId: data.employeeId || authSession.session?.employeeId || null,
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
      // FIX 500: Preveri ali miza obstaja preden jo posodobi.
      // Prej: tx.table.update({ where: { id: data.tableId } }) je vrnil P2025
      // če miza ne obstaja (npr. izbrisan medtem ko je bila v košarici).
      const tableExists = await tx.table.findUnique({ where: { id: data.tableId }, select: { id: true } })
      if (tableExists) {
        await tx.table.update({ where: { id: data.tableId }, data: { status: 'occupied' } })
      }
      // Če miza ne obstaja, ignoriramo — naročilo se ustvari brez mize
    }

    return newOrder
  })

  // ─── SAMODEJNO RAZKNJIŽEVANJE ZALOGE OB ODDAJI NAROČILA ───
  const { stockDeducted } = await handleStockDeduction(
    order.id, order.orderNumber,
    data.orderItems.map(item => ({ menuItemId: item.menuItemId, quantity: item.quantity })),
  )

  // Sproži stranske učinke (WS, tisk, webhook, revizija)
  await handlePostCreationEffects(order, authSession.session?.employeeId, stockDeducted)

  // Vrni naročilo z informacijami o zalogi
  return NextResponse.json(deepToNumbers({
    ...order,
    _stockInfo: {
      deducted: stockDeducted,
      lowStockWarnings: stockCheck.warnings,
      stockUnavailable: stockCheck.warnings,
    },
  }), { status: 201 })
}
