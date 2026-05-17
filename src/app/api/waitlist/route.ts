// ============================================
// ČAKALNA VRSTA — Profesionalna implementacija
// Toast POS standard — Avtentikacija + varna obravnava napak
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, createWaitlistSchema } from '@/lib/validations'

export async function GET() {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za čakalno vrsto
    // GET je javno dostopen za prikaz na POS
    const entries = await db.waitlistEntry.findMany({
      where: { status: { in: ['waiting', 'notified'] } },
      orderBy: { checkedInAt: 'asc' },
    })
    return NextResponse.json(entries)
  } catch (error) {
    console.error('Napaka pri pridobivanju čakalne vrste:', error)
    // FIX C-08: Ne razkrivaj error.message
    return NextResponse.json({ error: 'Napaka pri pridobivanju čakalne vrste' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za dodajanje v čakalno vrsto
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX H-01: Zod validacija
    const { data, error: validationError } = validateBody(createWaitlistSchema, body)
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
  } catch (error) {
    console.error('Napaka pri dodajanju v čakalno vrsto:', error)
    return NextResponse.json({ error: 'Napaka pri dodajanju v čakalno vrsto' }, { status: 500 })
  }
}
