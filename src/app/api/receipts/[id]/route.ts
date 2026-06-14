import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getNextReceiptNumber } from '@/lib/counters'
import { requireAuth } from '@/lib/auth-middleware'
import { createReceiptSchema, receiptResponseSchema, receiptCreatedResponseSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody, validateApiResponse } from '@/lib/api-utils'
import { toNum, round2, multiply, divide, deepToNumbers } from '@/lib/decimal'
import crypto from 'crypto'

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
    // FIX MEDIUM: Izključi voidane artikle iz računa
    const receiptItems = order.orderItems
      .filter(oi => !oi.voided)
      .map(oi => {
      let modifiers: { name: string; price?: number }[] = []
      try {
        modifiers = JSON.parse(oi.modifiersJson || '[]')
      } catch { /* empty */ }

      const vatRate = toNum(oi.vatRate) || toNum(oi.menuItem?.vatRate) || 22.0 // FIX: Decimal→number
      // FIX MEDIUM: Vključi ceno modifikatorjev v skupno ceno artikla
      let modifiersTotal = 0
      for (const mod of modifiers) {
        modifiersTotal += mod.price || 0
      }
      // FIX BUG2: Subtract discountAmount from basePrice — previously discount was not deducted per-item
      // This caused VAT breakdown to include undiscounted amounts, producing incorrect totals
      const basePrice = (toNum(oi.price) + modifiersTotal) * oi.quantity - toNum(oi.discountAmount) // FIX: Decimal→number, truthy bug
      const vatAmount = basePrice * (vatRate / 100)
      const totalWithVat = basePrice + vatAmount

      return {
        id: oi.id,
        name: oi.menuItem.name,
        quantity: oi.quantity,
        unitPrice: toNum(oi.price),
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
    const discount = toNum(order.discount) // FIX: Decimal→number
    const total = subtotal + totalVat - discount
    const tip = toNum(order.tip) // FIX: Decimal truthy — toNum() instead of || 0
    const totalWithTip = total + tip

    // Preveri če že obstaja račun
    const existingReceipt = await db.receipt.findFirst({ where: { orderId: id, isStorno: false } })
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

    return NextResponse.json(validateApiResponse(deepToNumbers(receipt), receiptResponseSchema, 'GET /api/receipts/[id]'))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/receipts/[id]', 'Napaka pri pridobivanju računa')
  }
}

// POST /api/receipts/[id] — Shrani/ustvari račun v bazo (ob plačilu)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(createReceiptSchema, bodyResult.data)
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
    const existing = await db.receipt.findFirst({ where: { orderId: id, isStorno: false } })
    if (existing) {
      return NextResponse.json(deepToNumbers(existing))
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
    // FIX BUG: Porazdeli popust proporcionalno po DDV stopnjah — FURS skladno
    // Brez tega je total narobe (subtotal + totalVat - discount ni enak vsoti itemov)
    const totalDiscount = toNum(order.discount) // FIX: Decimal truthy — toNum() instead of || 0
    const vatBreakdownForReceipt: Record<string, { base: number; vat: number }> = {}
    for (const oi of order.orderItems.filter(item => !item.voided)) {
      const vatRate = toNum(oi.vatRate) || toNum(oi.menuItem?.vatRate) || 22.0 // FIX: Decimal→number
      const rate = String(vatRate)
      // Uporabi že izračunani vatAmount (ki upošteva popust) če obstaja, sicer izračunaj
      const base = toNum(oi.price) * oi.quantity // FIX: Decimal→number
      const vat = toNum(oi.vatAmount) > 0 ? toNum(oi.vatAmount) : (base * (vatRate / 100)) // FIX: Decimal truthy — toNum() > 0 instead of ||
      if (!vatBreakdownForReceipt[rate]) vatBreakdownForReceipt[rate] = { base: 0, vat: 0 }
      vatBreakdownForReceipt[rate].base += base // base is already number
      vatBreakdownForReceipt[rate].vat += vat // vat is already number
    }

    // Porazdeli popust po DDV stopnjah (proporcionalno)
    if (totalDiscount > 0) {
      const totalBase = Object.values(vatBreakdownForReceipt).reduce((s, d) => s + d.base, 0)
      let discountDistributed = 0
      for (const [rate, data] of Object.entries(vatBreakdownForReceipt)) {
        const isLast = rate === Object.keys(vatBreakdownForReceipt).at(-1)
        let rateDiscount: number
        if (isLast) {
          rateDiscount = Math.round((totalDiscount - discountDistributed) * 100) / 100
        } else if (totalBase > 0) {
          rateDiscount = Math.round((data.base / totalBase) * totalDiscount * 100) / 100
        } else {
          rateDiscount = 0
        }
        discountDistributed += rateDiscount
        data.base -= rateDiscount
        // Preračunaj DDV na novi osnovi
        data.vat = round2(multiply(data.base, divide(Number(rate), 100)))
      }
    }

    // FIX CRITICAL: Atomna sekvenčna številka + ustvarjanje računa v transakciji (FURS skladnost)
    // Če db.receipt.create() odpove, se counter increment povrne — prepreči vrzeli v številkah računov
    const receipt = await db.$transaction(async (tx) => {
      const receiptNumber = await getNextReceiptNumber(tx)

      // ZOI placeholder
      const zoi = generateZOIPlaceholder(order.orderNumber, receiptNumber)

      const created = await tx.receipt.create({
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
          vatBreakdown: JSON.stringify(vatBreakdownForReceipt),
          totalVat: order.tax,
          discount: order.discount,
          total: order.total,
          tip: toNum(order.tip), // FIX: Decimal truthy — toNum() instead of || 0
          totalWithTip: round2(toNum(order.total) + toNum(order.tip)),
          paymentMethod: data.paymentMethod,
          isCopy: false,
          isStorno: data.isStorno,
          stornoOf: data.stornoOf,
        },
      })

      // FIX MEDIUM: Posodobi order paymentMethod če še ni nastavljen —
      // zagotovi konsistentnost med order in receipt
      if (!order.paymentMethod && data.paymentMethod) {
        await tx.order.update({
          where: { id },
          data: { paymentMethod: data.paymentMethod },
        })
      }

      return created
    })

    return NextResponse.json(validateApiResponse(deepToNumbers(receipt), receiptCreatedResponseSchema, 'POST /api/receipts/[id]'), { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/receipts/[id]', 'Napaka pri ustvarjanju računa')
  }
}

// PUT /api/receipts/[id] — Označi kot natisnjen ali ustvari kopijo
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    const body = bodyResult.data as Record<string, unknown>
    const receipt = await db.receipt.findFirst({ where: { orderId: id, isStorno: false } })
    if (!receipt) {
      return NextResponse.json({ error: 'Račun ni najden' }, { status: 404 })
    }

    // FIX HIGH: EOR se lahko nastavi SAMO prek FURS API-ja — ne direktno od klienta
    // Odstranjena možnost nastavitve eor, fiscalVerified iz klienta — varnostna zahteva
    const updated = await db.receipt.update({
      where: { id: receipt.id },
      data: {
        ...(body.printed !== undefined && { printedAt: body.printed ? new Date() : null }),
        ...(body.isCopy !== undefined && { isCopy: Boolean(body.isCopy) }),
      },
    })

    return NextResponse.json(deepToNumbers(updated))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/receipts/[id]', 'Napaka pri posodobitvi računa')
  }
}

// Placeholder ZOI generator (pravi ZOI potrebuje FURS certifikat in digitalni podpis)
// FIX CRITICAL: Determinističen ZOI placeholder — ESM import namesto require('crypto')
function generateZOIPlaceholder(orderNumber: number, receiptNumber: string): string {
  // Deterministični hash iz številke naročila + številke računa — vedno enak za isti račun
  const hash = crypto.createHash('sha256')
    .update(`ZOI-PLACEHOLDER-${orderNumber}-${receiptNumber}`)
    .digest('hex')
  // Vzamemo prvih 32 hex znakov (16 bajtov) in formatiramo
  return hash.substring(0, 32).toUpperCase()
}
