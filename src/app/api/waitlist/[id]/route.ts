// ============================================
// ČAKALNA VRSTA — Posodobi / Izbriši
// Avtentikacija + varna obravnava napak + state machine
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { z } from 'zod'

// FIX HIGH: State machine za čakalno vrsto — prepreči neveljavne prehode
const validWaitlistTransitions: Record<string, string[]> = {
  waiting: ['notified', 'seated', 'left', 'cancelled'],
  notified: ['seated', 'left', 'cancelled'],
  seated: [],
  left: [],
  cancelled: [],
}

// Zod validacijska shema za posodobitev vnosa čakalne vrste
const updateWaitlistSchema = z.object({
  action: z.enum(['notify', 'seat', 'leave', 'cancel'], { message: 'Dejanje mora biti notify, seat, leave ali cancel' }).optional(),
  tableId: z.string().max(100, 'ID mize ne sme preseči 100 znakov').optional(),
  guestName: z.string().min(1, 'Ime gosta je obvezno').max(200, 'Ime gosta ne sme preseči 200 znakov').optional(),
  partySize: z.number().int().min(1, 'Velikost skupine mora biti vsaj 1').max(50, 'Velikost skupine ne sme preseči 50').optional(),
  quotedWaitMinutes: z.number().int().min(0, 'Čakanje ne more biti negativno').max(999, 'Čakanje ne sme preseči 999 minut').optional(),
  preferredArea: z.string().max(200, 'Želeni prostor ne sme preseči 200 znakov').optional(),
  specialNeeds: z.string().max(500, 'Posebne potrebe ne smejo preseči 500 znakov').optional(),
  notes: z.string().max(1000, 'Opombe ne smejo preseči 1000 znakov').optional(),
})

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za posodabljanje čakalne vrste
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const { data, error: validationError } = await validateRequest(req, updateWaitlistSchema)
    if (validationError) return validationError

    // FIX HIGH: Preveri, da vnos obstaja
    const existing = await db.waitlistEntry.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Vnos v čakalni vrsti ni najden' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (data.action === 'notify') {
      // FIX HIGH: State machine validacija
      if (!validWaitlistTransitions[existing.status]?.includes('notified')) {
        return NextResponse.json({
          error: `Neveljaven prehod: ${existing.status} → notified`,
        }, { status: 400 })
      }
      updateData.status = 'notified'
      updateData.notifiedAt = new Date()
    } else if (data.action === 'seat') {
      if (!validWaitlistTransitions[existing.status]?.includes('seated')) {
        return NextResponse.json({
          error: `Neveljaven prehod: ${existing.status} → seated`,
        }, { status: 400 })
      }
      updateData.status = 'seated'
      updateData.seatedAt = new Date()
      updateData.tableId = data.tableId || null
      updateData.actualWaitMinutes = Math.round((Date.now() - existing.checkedInAt.getTime()) / 60000)
    } else if (data.action === 'leave') {
      if (!validWaitlistTransitions[existing.status]?.includes('left')) {
        return NextResponse.json({
          error: `Neveljaven prehod: ${existing.status} → left`,
        }, { status: 400 })
      }
      updateData.status = 'left'
      updateData.leftAt = new Date()
    } else if (data.action === 'cancel') {
      if (!validWaitlistTransitions[existing.status]?.includes('cancelled')) {
        return NextResponse.json({
          error: `Neveljaven prehod: ${existing.status} → cancelled`,
        }, { status: 400 })
      }
      updateData.status = 'cancelled'
      updateData.leftAt = new Date()
    } else {
      // Direct update — omejena polja
      if (data.guestName) updateData.guestName = data.guestName
      if (data.partySize) updateData.partySize = data.partySize
      if (data.quotedWaitMinutes !== undefined) updateData.quotedWaitMinutes = data.quotedWaitMinutes
      if (data.preferredArea !== undefined) updateData.preferredArea = data.preferredArea
      if (data.specialNeeds !== undefined) updateData.specialNeeds = data.specialNeeds
      if (data.notes !== undefined) updateData.notes = data.notes
    }

    const entry = await db.waitlistEntry.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(deepToNumbers(entry))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/waitlist/[id]', 'Napaka pri posodabljanju čakalne vrste')
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za brisanje iz čakalne vrste
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { id } = await params

    // FIX HIGH: Preveri, da vnos obstaja
    const existing = await db.waitlistEntry.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Vnos v čakalni vrsti ni najden' }, { status: 404 })
    }

    await db.waitlistEntry.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/waitlist/[id]', 'Napaka pri brisanju iz čakalne vrste')
  }
}
