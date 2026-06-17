// ============================================
// ČAKALNA VRSTA — Profesionalna implementacija
// Toast POS standard — Avtentikacija + varna obravnava napak
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { createWaitlistSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za čakalno vrsto — vsebovana imena gostov, telefoni
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error
    const entries = await db.waitlistEntry.findMany({
      where: { status: { in: ['waiting', 'notified'] } },
      orderBy: { checkedInAt: 'asc' },
    })
    return NextResponse.json(deepToNumbers(entries))
  } catch (error: unknown) {
    logger.error('API', 'Napaka pri pridobivanju čakalne vrste:', error)
    // FIX C-08: Ne razkrivaj error.message
    return NextResponse.json({ error: 'Napaka pri pridobivanju čakalne vrste' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za dodajanje v čakalno vrsto
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX H-01: Zod validacija
    const { data, error: validationError } = validateBody(createWaitlistSchema, bodyResult.data)
    if (validationError) return validationError

    const entry = await db.waitlistEntry.create({
      data: {
        guestName: data.guestName,
        guestPhone: data.guestPhone || '',
        partySize: data.partySize,
        quotedWaitMinutes: data.quotedWaitMinutes || 0,
        preferredArea: data.preferredArea || '',
        specialNeeds: data.specialNeeds || '',
        status: 'waiting',
        notes: data.notes || '',
        employeeId: authResult.session?.employeeId || null,
      },
    })
    return NextResponse.json(entry, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/waitlist', 'Napaka pri dodajanju v čakalno vrsto')
  }
}
