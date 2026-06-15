import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getNextReceiptNumber } from '@/lib/counters'
import { requireAuth } from '@/lib/auth-middleware'
import { createReceiptSchema, receiptResponseSchema, receiptCreatedResponseSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody, validateApiResponse } from '@/lib/api-utils'
import { toNum, round2, deepToNumbers } from '@/lib/decimal'
import {
  generateZOIPlaceholder,
  MINIMAL_SETTINGS,
  calculateVatBreakdownForReceipt,
} from './_helpers'
import { buildReceiptPreview } from './_route-helpers'

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

    // Preveri če že obstaja račun
    const existingReceipt = await db.receipt.findFirst({ where: { orderId: id, isStorno: false } })

    const receipt = buildReceiptPreview(order, settings, existingReceipt)

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
    const s2 = settings || MINIMAL_SETTINGS

    // Izračunaj DDV razdelitev (strežniško — edini vir resnice)
    const totalDiscount = toNum(order.discount)
    const vatBreakdownForReceipt = calculateVatBreakdownForReceipt(order.orderItems, totalDiscount)

    // FIX CRITICAL: Atomna sekvenčna številka + ustvarjanje računa v transakciji (FURS skladnost)
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
          tip: toNum(order.tip),
          totalWithTip: round2(toNum(order.total) + toNum(order.tip)),
          paymentMethod: data.paymentMethod,
          isCopy: false,
          isStorno: data.isStorno,
          stornoOf: data.stornoOf,
        },
      })

      // FIX MEDIUM: Posodobi order paymentMethod če še ni nastavljen
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
