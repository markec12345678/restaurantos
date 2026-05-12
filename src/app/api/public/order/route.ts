import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getNextCounter } from '@/lib/counters'
import { z } from 'zod'

// Javni API za naročanje iz QR kode - BREZ avtentikacije
// Stranka skenira QR kodo na mizi in naroči direktno

// Helper za WebSocket broadcast
async function broadcastWS(type: string, payload: unknown) {
  try {
    await fetch('http://localhost:3000/api/ws-broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    })
  } catch {
    // WS strežnik ni na voljo
  }
}

// Validacijska shema za QR naročilo
const qrOrderSchema = z.object({
  tableId: z.string().min(1),
  customerName: z.string().max(100).default(''),
  customerPhone: z.string().max(30).default(''),
  orderItems: z.array(z.object({
    menuItemId: z.string().min(1),
    quantity: z.int().min(1).max(50),
    notes: z.string().max(200).default(''),
    modifiersJson: z.string().default('[]'),
  })).min(1).max(50),
  notes: z.string().max(500).default(''),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    let data: z.infer<typeof qrOrderSchema> | null = null
    try {
      data = qrOrderSchema.parse(body)
    } catch (e) {
      return NextResponse.json(
        { error: 'Neveljavni podatki naročila', details: String(e) },
        { status: 400 }
      )
    }

    // Preveri, da miza obstaja
    const table = await db.table.findUnique({ where: { id: data.tableId } })
    if (!table) {
      return NextResponse.json({ error: 'Miza ni najdena' }, { status: 404 })
    }

    // Atomic counter za orderNumber
    const orderNumber = await getNextCounter('orderNumber')

    // Pridobi podatke artiklov iz baze (strežniška stran = edini vir resnice)
    const menuItemIds = data.orderItems.map(item => item.menuItemId)
    const menuItems = await db.menuItem.findMany({
      where: { id: { in: menuItemIds }, isAvailable: true },
      select: { id: true, vatRate: true, price: true, name: true },
    })
    const vatMap = new Map(menuItems.map(mi => [mi.id, mi]))

    // Preveri, da vsi artikli obstajajo in so na voljo
    for (const item of data.orderItems) {
      if (!vatMap.has(item.menuItemId)) {
        return NextResponse.json(
          { error: `Artikel ${item.menuItemId} ni na voljo` },
          { status: 400 }
        )
      }
    }

    // Izračun z multi-DDV
    let subtotal = 0
    let totalTax = 0
    const orderItemsData = data.orderItems.map(item => {
      const mi = vatMap.get(item.menuItemId)!
      const vatRate = mi.vatRate
      const price = mi.price
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

    const total = subtotal + totalTax

    // Ustvari naročilo
    const order = await db.order.create({
      data: {
        orderNumber,
        type: 'dine-in',
        status: 'pending',
        tableId: data.tableId,
        customerName: data.customerName || `Miza ${table.number}`,
        customerPhone: data.customerPhone,
        subtotal,
        tax: totalTax,
        discount: 0,
        total,
        tip: 0,
        totalWithTip: total,
        paymentStatus: 'unpaid',
        paymentMethod: '',
        notes: `[QR NAROČILO] ${data.notes}`,
        employeeId: null,
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

    // Posodobi status mize
    await db.table.update({
      where: { id: data.tableId },
      data: { status: 'occupied' },
    })

    // WebSocket: obvesti KDS o novem QR naročilu
    broadcastWS('NEW_ORDER', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      type: order.type,
      tableId: order.tableId,
      total: order.total,
      source: 'qr',
    })

    // Revizijski dnevnik
    await createAuditLog({
      userId: 'qr-customer',
      action: 'QR_ORDER',
      entityType: 'Order',
      entityId: order.id,
      details: {
        orderNumber: order.orderNumber,
        total: order.total,
        tableId: data.tableId,
        tableNumber: table.number,
        customerName: data.customerName,
        itemCount: data.orderItems.length,
      },
    })

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        tableNumber: table.number,
        createdAt: order.createdAt,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('[PUBLIC ORDER] Napaka:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju naročila' }, { status: 500 })
  }
}
