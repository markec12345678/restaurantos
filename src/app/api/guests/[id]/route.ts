// ============================================
// GOST CRM — Posodobi / Izbriši / Pridobi
// Toast POS standard — Avtentikacija + Zod validacija
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, updateGuestSchema } from '@/lib/validations'

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
  } catch (error) {
    console.error('Napaka pri pridobivanju gosta:', error)
    // FIX C-03: Ne razkrivaj error.message
    return NextResponse.json({ error: 'Napaka pri pridobivanju gosta' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX C-01: Zahtevaj avtentikacijo za posodabljanje gosta
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const body = await req.json()

    // FIX C-04: Zod validacija namesto ročnega beleženja polj
    const { data, error: validationError } = validateBody(updateGuestSchema, body)
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
  } catch (error) {
    console.error('Napaka pri posodabljanju gosta:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju gosta' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX C-01: Zahtevaj avtentikacijo za brisanje gosta
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params

    const existing = await db.guest.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Gost ni najden' }, { status: 404 })
    }

    await db.guest.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Napaka pri brisanju gosta:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju gosta' }, { status: 500 })
  }
}
