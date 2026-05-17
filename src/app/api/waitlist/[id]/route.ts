// ============================================
// ČAKALNA VRSTA — Posodobi / Izbriši
// Avtentikacija + varna obravnava napak
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za posodabljanje čakalne vrste
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const body = await req.json()

    const updateData: Record<string, unknown> = {}

    if (body.action === 'notify') {
      updateData.status = 'notified'
      updateData.notifiedAt = new Date()
    } else if (body.action === 'seat') {
      updateData.status = 'seated'
      updateData.seatedAt = new Date()
      updateData.tableId = body.tableId || null
      // Calculate actual wait time
      const entry = await db.waitlistEntry.findUnique({ where: { id } })
      if (entry) {
        updateData.actualWaitMinutes = Math.round((Date.now() - entry.checkedInAt.getTime()) / 60000)
      }
    } else if (body.action === 'leave') {
      updateData.status = 'left'
      updateData.leftAt = new Date()
    } else if (body.action === 'cancel') {
      updateData.status = 'cancelled'
      updateData.leftAt = new Date()
    } else {
      // Direct update — omejena polja
      if (body.guestName) updateData.guestName = body.guestName
      if (body.partySize) updateData.partySize = body.partySize
      if (body.quotedWaitMinutes !== undefined) updateData.quotedWaitMinutes = body.quotedWaitMinutes
      if (body.preferredArea !== undefined) updateData.preferredArea = body.preferredArea
      if (body.specialNeeds !== undefined) updateData.specialNeeds = body.specialNeeds
      if (body.notes !== undefined) updateData.notes = body.notes
    }

    const entry = await db.waitlistEntry.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(entry)
  } catch (error) {
    console.error('Napaka pri posodabljanju čakalne vrste:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju čakalne vrste' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za brisanje iz čakalne vrste
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { id } = await params
    await db.waitlistEntry.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Napaka pri brisanju iz čakalne vrste:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju iz čakalne vrste' }, { status: 500 })
  }
}
