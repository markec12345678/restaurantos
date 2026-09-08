// ============================================
// STAFF SHIFTS [id] API — Posodobi/Izbriši izmeno
// ============================================

// ============================================
// PATCH — Posodobi izmeno
// ============================================
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'
import { parseJsonBody, handleApiError } from '@/lib/api-utils'


export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX: Staff shift management requires manage_employees, not manage_cash
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    const body = bodyResult.data as Record<string, unknown>

    // FIX MEDIUM: Zod validacija za posodobitev izmene — prepreči neveljavne vnose
    const patchSchema = z.object({
      shiftType: z.enum(['morning', 'afternoon', 'evening', 'night', 'split', 'custom']).optional(),
      startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:mm').optional(),
      endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:mm').optional(),
      role: z.string().max(50).optional(),
      notes: z.string().max(500).optional(),
      status: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(),
      // FIX IDOR: locationId ODSTRANJEN iz dovoljenih polj — tenant pripadnost
      // NE sme prihajati iz request bodyja (server določa iz sessiona).
      // Zod z.object() default strip-a neznana polja → locationId iz bodyja se ignorira.
    })
    const { data: patchData, error: patchError } = patchSchema.safeParse(body)
    if (patchError) {
      return NextResponse.json({ error: 'Neveljavni podatki', validationErrors: patchError.issues.map(e => ({ field: e.path.join('.'), message: e.message })) }, { status: 400 })
    }

    const safeData: Record<string, unknown> = { ...patchData }

    // FIX IDOR (tenant scope): findUnique → findFirst z locationId scope
    // (manager lokacije A ne more urejati izmen lokacije B)
    const sessionLocationId = authResult.session?.locationId ?? undefined
    const existing = await db.staffShift.findFirst({
      where: { id, ...(sessionLocationId ? { locationId: sessionLocationId } : {}) },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Izmena ni najdena' }, { status: 404 })
    }

    // Če spreminjamo status na confirmed
    if (safeData.status === 'confirmed' && existing.status === 'scheduled') {
      safeData['confirmedAt'] = new Date()
    }

    const shift = await db.staffShift.update({
      where: { id },
      data: safeData,
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

    return NextResponse.json(deepToNumbers(shift))
  } catch (error: unknown) {
    return handleApiError(error, 'PATCH /api/staff-shifts/[id]', 'Napaka pri posodabljanju izmene')
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

    // FIX IDOR (tenant scope): izbriši SAMO izmeno znotraj session lokacije
    const sessionLocationId = authResult.session?.locationId ?? undefined
    const existing = await db.staffShift.findFirst({
      where: { id, ...(sessionLocationId ? { locationId: sessionLocationId } : {}) },
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
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/staff-shifts/[id]', 'Napaka pri brisanju izmene')
  }
}
