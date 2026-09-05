import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { receiptResponseSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateApiResponse } from '@/lib/api-utils'
import { deepToNumbers } from '@/lib/decimal'
import { buildReceiptPreview } from './_route-helpers'
import { handlePostReceipt } from './_helpers/post-handler'
import { getRestaurantInfoForLocation } from '@/lib/furs/config-resolver'


// GET /api/receipts/[id] — Generiraj račun s predogledom (ZDDV-1 skladen)
export const dynamic = 'force-dynamic'

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

    // FIX P0-C3A: Pridobi poslovne podatke iz Location (vezano na order.locationId)
    // Prej: settings.findFirst({isActive:true}) — globalno, v multi-tenant napačna lokacija
    const info = await getRestaurantInfoForLocation(order.locationId)
    // Pretvori v format, ki ga pričakuje buildReceiptPreview (podobno RestaurantSettings)
    const settings = {
      name: info.name,
      address: info.address,
      postCode: info.postCode,
      city: info.city,
      phone: info.phone,
      email: '',
      businessId: info.businessId,
      taxId: info.taxId,
      registerNumber: info.registerNumber,
      receiptFooter: '',
    }

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

    return await handlePostReceipt(req, id, authResult as { session?: { employeeId?: string } | null })
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
