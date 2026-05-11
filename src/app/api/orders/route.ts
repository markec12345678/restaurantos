import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getNextCounter } from '@/lib/counters'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, createOrderSchema } from '@/lib/validations'

// Helper za WebSocket broadcast (varen klic — deluje tudi brez WS strežnika)
async function broadcastWS(type: string, payload: unknown) {
  try {
    await fetch('http://localhost:3000/api/ws-broadcast', {
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
    await fetch('http://localhost:3000/api/print', {
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
    // Avtentikacija za GET ni obvezna (KDS rabi dostop)
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const paymentStatus = searchParams.get('paymentStatus')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (type) where.type = type
    if (paymentStatus) where.paymentStatus = paymentStatus

    const orders = await db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        table: true,
        orderItems: { include: { menuItem: true } },
      },
    })
    return NextResponse.json(orders)
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

    // Izračun z multi-DDV po stopnjah (strežniška stran — edini vir resnice)
    let subtotal = 0
    let totalTax = 0
    const orderItemsData = data.orderItems.map(item => {
      const mi = vatMap.get(item.menuItemId)!
      const vatRate = mi.vatRate
      const price = mi.price // FIX C-02: Strežniška cena iz baze — edini vir resnice
      const itemBase = price * item.quantity
      const vatAmount = itemBase * (vatRate / 100)
      subtotal += itemBase
      totalTax += vatAmount
      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price,
        vatRate,
        vatAmount,
        notes: item.notes,
        modifiersJson: item.modifiersJson,
        status: 'pending' as const,
      }
    })

    // FIX H-03: Popust ne more preseči vmesne vsote
    const discount = Math.min(data.discount || 0, subtotal)
    const total = subtotal + totalTax - discount

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
        discount,
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
      details: { orderNumber: order.orderNumber, total: order.total, type: order.type, tableId: order.tableId },
    })

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    console.error('Napaka pri ustvarjanju naročila:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju naročila' }, { status: 500 })
  }
}
