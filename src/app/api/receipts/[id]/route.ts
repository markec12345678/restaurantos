import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getNextReceiptNumber } from '@/lib/counters'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, createReceiptSchema } from '@/lib/validations'

// GET /api/receipts/[id] — Generiraj račun s predogledom (ZDDV-1 skladen)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za ogled računa
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error
    const { id } = await params

    const order = await db.order.findUnique({
      where: { id },
      include: {
        table: true,
        orderItems: {
          include: { menuItem: { include: { category: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
    }

    // Pridobi nastavitve restavracije
    const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })
    const s = settings || {
      name: 'RestaurantOS',
      address: 'Podčetrtk 97',
      city: 'Podčetrtk',
      postCode: '3254',
      phone: '+386 3 818 30 00',
      email: '',
      taxId: 'SI12345678',
      businessId: '12345678',
      registerNumber: 'BLG-001',
      receiptFooter: 'Hvala za obisk!',
    }

    // Parse modifiers from JSON
    const receiptItems = order.orderItems.map(oi => {
      let modifiers: { name: string; price?: number }[] = []
      try {
        modifiers = JSON.parse(oi.modifiersJson || '[]')
      } catch { /* empty */ }

      const vatRate = oi.vatRate || oi.menuItem?.vatRate || 22.0
      const basePrice = oi.price * oi.quantity
      const vatAmount = basePrice * (vatRate / 100)
      const totalWithVat = basePrice + vatAmount

      return {
        id: oi.id,
        name: oi.menuItem.name,
        quantity: oi.quantity,
        unitPrice: oi.price,
        vatRate,
        basePrice,
        vatAmount,
        totalWithVat,
        modifiers,
        notes: oi.notes,
        category: oi.menuItem.category?.name || '',
      }
    })

    // DDV razdelitev po stopnjah
    const vatBreakdown: Record<string, { base: number; vat: number; total: number }> = {}
    for (const item of receiptItems) {
      const rate = String(item.vatRate)
      if (!vatBreakdown[rate]) vatBreakdown[rate] = { base: 0, vat: 0, total: 0 }
      vatBreakdown[rate].base += item.basePrice
      vatBreakdown[rate].vat += item.vatAmount
      vatBreakdown[rate].total += item.totalWithVat
    }

    const subtotal = receiptItems.reduce((sum, item) => sum + item.basePrice, 0)
    const totalVat = receiptItems.reduce((sum, item) => sum + item.vatAmount, 0)
    const discount = order.discount
    const total = subtotal + totalVat - discount
    const tip = order.tip || 0
    const totalWithTip = total + tip

    // Preveri če že obstaja račun
    const existingReceipt = await db.receipt.findFirst({ where: { orderId: id } })
    const receiptNumber = existingReceipt?.receiptNumber || ''
    const zoi = existingReceipt?.zoi || generateZOIPlaceholder(order.orderNumber, receiptNumber || 'pending')

    const receipt = {
      receiptNumber,
      receiptDate: existingReceipt?.createdAt?.toISOString() || new Date().toISOString(),
      registerId: s.registerNumber || 'BLG-001',
      businessName: s.name,
      businessAddress: `${s.address}, ${s.postCode} ${s.city}`,
      businessId: s.businessId,
      taxId: s.taxId,
      phone: s.phone,
      zoi,
      eor: existingReceipt?.eor || '',
      fiscalVerified: existingReceipt?.fiscalVerified || false,
      orderNumber: order.orderNumber,
      type: order.type,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      customerName: order.customerName,
      table: order.table ? { number: order.table.number, area: order.table.area } : null,
      notes: order.notes,
      createdAt: order.createdAt,
      items: receiptItems,
      subtotal: Math.round(subtotal * 100) / 100,
      vatBreakdown: Object.fromEntries(
        Object.entries(vatBreakdown).map(([rate, data]) => [
          rate,
          {
            base: Math.round(data.base * 100) / 100,
            vat: Math.round(data.vat * 100) / 100,
            total: Math.round(data.total * 100) / 100,
          },
        ])
      ),
      totalVat: Math.round(totalVat * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      total: Math.round(total * 100) / 100,
      tip: Math.round(tip * 100) / 100,
      totalWithTip: Math.round(totalWithTip * 100) / 100,
      receiptFooter: s.receiptFooter || '',
      isCopy: existingReceipt?.isCopy || false,
      isStorno: existingReceipt?.isStorno || false,
      stornoOf: existingReceipt?.stornoOf || '',
    }

    return NextResponse.json(receipt)
  } catch (error) {
    console.error('Napaka pri pridobivanju računa:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju računa' }, { status: 500 })
  }
}

// POST /api/receipts/[id] — Shrani/ustvari račun v bazo (ob plačilu)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(createReceiptSchema, body)
    if (validationError) return validationError

    const order = await db.order.findUnique({
      where: { id },
      include: { orderItems: { include: { menuItem: true } } },
    })

    if (!order) {
      return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
    }

    // FIX: Preveri, da je naročilo plačano preden se ustvari račun
    if (order.paymentStatus !== 'paid' && order.paymentStatus !== 'partial') {
      return NextResponse.json({ error: 'Naročilo mora biti plačano preden se ustvari račun' }, { status: 400 })
    }

    // Preveri če že obstaja
    const existing = await db.receipt.findFirst({ where: { orderId: id } })
    if (existing) {
      return NextResponse.json(existing)
    }

    // Pridobi nastavitve
    const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })
    const s2 = settings || {
      name: 'RestaurantOS',
      address: '',
      postCode: '',
      city: '',
      businessId: '',
      taxId: '',
      registerNumber: 'BLG-001',
    }

    // Izračunaj DDV razdelitev (strežniško — edini vir resnice)
    const vatBreakdown: Record<string, { base: number; vat: number }> = {}
    for (const oi of order.orderItems) {
      const vatRate = oi.vatRate || oi.menuItem?.vatRate || 22.0
      const rate = String(vatRate)
      const base = oi.price * oi.quantity
      const vat = base * (vatRate / 100)
      if (!vatBreakdown[rate]) vatBreakdown[rate] = { base: 0, vat: 0 }
      vatBreakdown[rate].base += base
      vatBreakdown[rate].vat += vat
    }

    // Atomna sekvenčna številka računa
    const receiptNumber = await getNextReceiptNumber()

    // ZOI placeholder
    const zoi = generateZOIPlaceholder(order.orderNumber, receiptNumber)

    const receipt = await db.receipt.create({
      data: {
        receiptNumber,
        orderId: id,
        businessName: s2.name,
        businessAddress: `${s2.address}, ${s2.postCode} ${s2.city}`,
        businessId: s2.businessId,
        taxId: s2.taxId,
        registerId: s2.registerNumber,
        zoi,
        eor: '',
        fiscalVerified: false,
        subtotal: order.subtotal,
        vatBreakdown: JSON.stringify(vatBreakdown),
        totalVat: order.tax,
        discount: order.discount,
        total: order.total,
        tip: order.tip || 0,
        totalWithTip: order.totalWithTip || (order.total + (order.tip || 0)),
        paymentMethod: data.paymentMethod,
        isCopy: false,
        isStorno: data.isStorno,
        stornoOf: data.stornoOf,
      },
    })

    return NextResponse.json(receipt, { status: 201 })
  } catch (error) {
    console.error('Napaka pri ustvarjanju računa:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju računa' }, { status: 500 })
  }
}

// PUT /api/receipts/[id] — Označi kot natisnjen ali ustvari kopijo
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const body = await req.json()
    const receipt = await db.receipt.findFirst({ where: { orderId: id } })
    if (!receipt) {
      return NextResponse.json({ error: 'Račun ni najden' }, { status: 404 })
    }

    const updated = await db.receipt.update({
      where: { id: receipt.id },
      data: {
        ...(body.printed !== undefined && { printedAt: body.printed ? new Date() : null }),
        ...(body.isCopy !== undefined && { isCopy: body.isCopy }),
        // FIX: fiscalVerified se lahko nastavi SAMO prek FURS API-ja — ne direktno od klienta
        // ...(body.fiscalVerified !== undefined && { fiscalVerified: body.fiscalVerified, verificationDate: body.fiscalVerified ? new Date() : null }),
        ...(body.eor !== undefined && { eor: body.eor }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Napaka pri posodobitvi računa:', error)
    return NextResponse.json({ error: 'Napaka pri posodobitvi računa' }, { status: 500 })
  }
}

// Placeholder ZOI generator (pravi ZOI potrebuje FURS certifikat in digitalni podpis)
function generateZOIPlaceholder(orderNumber: number, receiptNumber: string): string {
  const timestamp = Date.now().toString(16).padStart(12, '0')
  const orderHex = orderNumber.toString(16).padStart(8, '0')
  const random = Math.random().toString(16).substring(2, 14)
  return `${timestamp}-${orderHex}-${random}`.toUpperCase()
}
