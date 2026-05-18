// ============================================
// STAFF SHIFTS [id] API — Posodobi/Izbriši izmeno
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

// ============================================
// PATCH — Posodobi izmeno
// ============================================
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const body = await req.json()

    const existing = await db.staffShift.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Izmena ni najdena' }, { status: 404 })
    }

    // Če spreminjamo status na confirmed
    if (body.status === 'confirmed' && existing.status === 'scheduled') {
      body.confirmedAt = new Date()
    }

    const shift = await db.staffShift.update({
      where: { id },
      data: body,
      include: {
        employee: { select: { id: true, name: true, role: true } },
        location: { select: { id: true, name: true, code: true } },
      },
    })

    await createAuditLog({
      action: 'STAFF_SHIFT_UPDATED',
      entityType: 'StaffShift',
      entityId: id,
      details: { employeeName: shift.employee?.name, shiftType: body.shiftType || existing.shiftType },
      userId: authResult.session?.employeeId,
    })

    return NextResponse.json(shift)
  } catch (error) {
    console.error('[STAFF-SHIFTS PATCH]', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju izmene' }, { status: 500 })
  }
}

// ============================================
// DELETE — Izbriši izmeno
// ============================================
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params

    const existing = await db.staffShift.findUnique({
      where: { id },
      include: { employee: { select: { name: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Izmena ni najdena' }, { status: 404 })
    }

    await db.staffShift.delete({ where: { id } })

    await createAuditLog({
      action: 'STAFF_SHIFT_DELETED',
      entityType: 'StaffShift',
      entityId: id,
      details: { employeeName: existing.employee?.name, shiftDate: existing.shiftDate?.toISOString() },
      userId: authResult.session?.employeeId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[STAFF-SHIFTS DELETE]', error)
    return NextResponse.json({ error: 'Napaka pri brisanju izmene' }, { status: 500 })
  }
}
