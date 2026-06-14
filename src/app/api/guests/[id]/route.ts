// ============================================
// GOST CRM — Posodobi / Izbriši / Pridobi
// Toast POS standard — Avtentikacija + Zod validacija
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { updateGuestSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX C-01: Zahtevaj avtentikacijo za dostop do gosta
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const guest = await db.guest.findUnique({
      where: { id },
      include: {
        loyaltyAccount: { include: { transactions: { orderBy: { createdAt: 'desc' }, take: 10 } } },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { orderItems: { include: { menuItem: true } } },
        },
      },
    })

    if (!guest) {
      return NextResponse.json({ error: 'Gost ni najden' }, { status: 404 })
    }

    return NextResponse.json(guest)
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/guests/[id]', 'Napaka pri pridobivanju gosta')
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX C-01: Zahtevaj avtentikacijo za posodabljanje gosta
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX C-04: Zod validacija namesto ročnega beleženja polj
    const { data, error: validationError } = validateBody(updateGuestSchema, bodyResult.data)
    if (validationError) return validationError

    // Preveri, da gost obstaja
    const existing = await db.guest.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Gost ni najden' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (data.firstName !== undefined) updateData.firstName = data.firstName
    if (data.lastName !== undefined) updateData.lastName = data.lastName
    if (data.email !== undefined) updateData.email = data.email
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.isVip !== undefined) {
      updateData.isVip = data.isVip
      if (data.isVip && !existing.isVip) updateData.vipSince = new Date()
    }
    if (data.allergens !== undefined) updateData.allergens = JSON.stringify(data.allergens)
    if (data.dietaryPrefs !== undefined) updateData.dietaryPrefs = JSON.stringify(data.dietaryPrefs)
    if (data.dislikes !== undefined) updateData.dislikes = JSON.stringify(data.dislikes)
    if (data.favoriteItems !== undefined) updateData.favoriteItems = JSON.stringify(data.favoriteItems)
    if (data.birthday !== undefined) updateData.birthday = data.birthday ? new Date(data.birthday) : null
    if (data.anniversary !== undefined) updateData.anniversary = data.anniversary ? new Date(data.anniversary) : null
    if (data.company !== undefined) updateData.company = data.company
    if (data.notes !== undefined) updateData.notes = data.notes

    const guest = await db.guest.update({
      where: { id },
      data: updateData,
      include: { loyaltyAccount: true },
    })

    return NextResponse.json(guest)
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/guests/[id]', 'Napaka pri posodabljanju gosta')
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX C-01: Zahtevaj avtentikacijo za brisanje gosta
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params

    const existing = await db.guest.findUnique({
      where: { id },
      include: { orders: { select: { id: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Gost ni najden' }, { status: 404 })
    }

    // FIX HIGH: Prepreči hard-delete — uporabi soft-delete (anonymize PII)
    // Če ima gost naročila, ne smemo izbrisati (FK constraints + GDPR evidence)
    if (existing.orders.length > 0) {
      return NextResponse.json(
        { error: 'Gost ima obstoječa naročila in ne more biti izbrisan. Anonimizirajte namesto tega.' },
        { status: 400 }
      )
    }

    // Soft-delete: anonymize PII, ohrani zapis za referenco
    // FIX HIGH: Anonimiziraj TUDI JSON PII polja (allergens, dietaryPrefs, dislikes, favoriteItems)
    // Prejšnja koda je pustila osebne preference — kršitev GDPR (pravica do izbrisa)
    await db.guest.update({
      where: { id },
      data: {
        firstName: '[Izbrisano]',
        lastName: '[Izbrisano]',
        email: '',
        phone: '',
        notes: '',
        company: '',
        birthday: null,
        anniversary: null,
        allergens: '[]',
        dietaryPrefs: '[]',
        dislikes: '[]',
        favoriteItems: '[]',
      },
    })

    return NextResponse.json({ success: true, message: 'Gost anonimiziran' })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/guests/[id]', 'Napaka pri brisanju gosta')
  }
}
