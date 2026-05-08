import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/receipts/[id] — Generiraj račun s predogledom (ZDDV-1 skladen)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  let settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })
  if (!settings) {
    settings = {
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
    } as any
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
      unitPrice: oi.price,          // Cena brez DDV
      vatRate,                       // DDV stopnja
      basePrice,                     // Osnova (skupaj brez DDV)
      vatAmount,                     // Znesek DDV
      totalWithVat,                  // Skupaj z DDV
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
  let existingReceipt = await db.receipt.findFirst({ where: { orderId: id } })

  // Generiraj številko računa (sekvenčna, brez preskoka)
  let receiptNumber = existingReceipt?.receiptNumber || ''
  if (!receiptNumber) {
    const lastReceipt = await db.receipt.findFirst({ orderBy: { createdAt: 'desc' }, select: { receiptNumber: true } })
    const year = new Date().getFullYear()
    let seq = 1
    if (lastReceipt?.receiptNumber) {
      const match = lastReceipt.receiptNumber.match(/R-(\d+)-(\d+)/)
      if (match && match[1] === String(year)) {
        seq = parseInt(match[2]) + 1
      }
    }
    receiptNumber = `R-${year}-${String(seq).padStart(6, '0')}`
  }

  // FURS ZOI generiranje (placeholder - pravi ZOI potrebuje digitalni podpis)
  const zoi = existingReceipt?.zoi || generateZOIPlaceholder(order.orderNumber, receiptNumber)

  const receipt = {
    // === GLAVA RAČUNA ===
    receiptNumber,
    receiptDate: existingReceipt?.createdAt?.toISOString() || new Date().toISOString(),
    registerId: settings.registerNumber || 'BLG-001',
    
    // === PODATKI IZDAJATELJA ===
    businessName: settings.name,
    businessAddress: `${settings.address}, ${settings.postCode} ${settings.city}`,
    businessId: settings.businessId,
    taxId: settings.taxId,
    phone: settings.phone,
    
    // === DAVČNO POTRJEVANJE ===
    zoi,
    eor: existingReceipt?.eor || '',
    fiscalVerified: existingReceipt?.fiscalVerified || false,
    
    // === NAROČILO ===
    orderNumber: order.orderNumber,
    type: order.type,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    customerName: order.customerName,
    table: order.table ? { number: order.table.number, area: order.table.area } : null,
    notes: order.notes,
    createdAt: order.createdAt,
    
    // === POSTAVKE ===
    items: receiptItems,
    
    // === ZNESEKI ===
    subtotal: Math.round(subtotal * 100) / 100,
    vatBreakdown: Object.fromEntries(
      Object.entries(vatBreakdown).map(([rate, data]) => [
        rate, 
        { 
          base: Math.round(data.base * 100) / 100, 
          vat: Math.round(data.vat * 100) / 100,
          total: Math.round(data.total * 100) / 100 
        }
      ])
    ),
    totalVat: Math.round(totalVat * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    total: Math.round(total * 100) / 100,
    tip: Math.round(tip * 100) / 100,
    totalWithTip: Math.round(totalWithTip * 100) / 100,
    
    // === NOGA ===
    receiptFooter: settings.receiptFooter || '',
    isCopy: existingReceipt?.isCopy || false,
    isStorno: existingReceipt?.isStorno || false,
    stornoOf: existingReceipt?.stornoOf || '',
  }

  return NextResponse.json(receipt)
}

// POST /api/receipts/[id] — Shrani/ustvari račun v bazo (ob plačilu)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const order = await db.order.findUnique({
    where: { id },
    include: { orderItems: { include: { menuItem: true } } },
  })

  if (!order) {
    return NextResponse.json({ error: 'Naročilo ni najdeno' }, { status: 404 })
  }

  // Preveri če že obstaja
  const existing = await db.receipt.findFirst({ where: { orderId: id } })
  if (existing) {
    return NextResponse.json(existing)
  }

  // Pridobi nastavitve
  const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })

  // Izračunaj DDV razdelitev
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

  // Generiraj sekvenčno številko
  const lastReceipt = await db.receipt.findFirst({ orderBy: { createdAt: 'desc' }, select: { receiptNumber: true } })
  const year = new Date().getFullYear()
  let seq = 1
  if (lastReceipt?.receiptNumber) {
    const match = lastReceipt.receiptNumber.match(/R-(\d+)-(\d+)/)
    if (match && match[1] === String(year)) {
      seq = parseInt(match[2]) + 1
    }
  }
  const receiptNumber = `R-${year}-${String(seq).padStart(6, '0')}`

  // ZOI placeholder
  const zoi = generateZOIPlaceholder(order.orderNumber, receiptNumber)

  const receipt = await db.receipt.create({
    data: {
      receiptNumber,
      orderId: id,
      businessName: settings?.name || 'RestaurantOS',
      businessAddress: settings ? `${settings.address}, ${settings.postCode} ${settings.city}` : '',
      businessId: settings?.businessId || '',
      taxId: settings?.taxId || '',
      registerId: settings?.registerNumber || 'BLG-001',
      zoi,
      eor: '',
      fiscalVerified: false,
      subtotal: order.subtotal,
      vatBreakdown: JSON.stringify(vatBreakdown),
      totalVat: order.tax,
      discount: order.discount,
      total: order.total,
      tip: order.tip || 0,
      totalWithTip: (order.totalWithTip || order.total) + (order.tip || 0),
      paymentMethod: order.paymentMethod || body.paymentMethod || 'gotovina',
      isCopy: false,
      isStorno: body.isStorno || false,
      stornoOf: body.stornoOf || '',
    },
  })

  return NextResponse.json(receipt)
}

// PUT /api/receipts/[id] — Označi kot natisnjen ali ustvari kopijo
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
      ...(body.fiscalVerified !== undefined && { fiscalVerified: body.fiscalVerified, verificationDate: body.fiscalVerified ? new Date() : null }),
      ...(body.eor !== undefined && { eor: body.eor }),
    },
  })

  return NextResponse.json(updated)
}

// Placeholder ZOI generator (pravi ZOI potrebuje FURS certifikat in digitalni podpis)
function generateZOIPlaceholder(orderNumber: number, receiptNumber: string): string {
  // ZOI mora biti 32-mestna hex številka, generirana iz certifikata
  // To je placeholder dokler ne integriramo FURS povezave
  const timestamp = Date.now().toString(16).padStart(12, '0')
  const orderHex = orderNumber.toString(16).padStart(8, '0')
  const random = Math.random().toString(16).substring(2, 14)
  return `${timestamp}-${orderHex}-${random}`.toUpperCase()
}
