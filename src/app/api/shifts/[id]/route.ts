
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { updateShiftSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX: Zod validacija namesto ročnega preslikavanja
    const { data, error: validationError } = validateBody(updateShiftSchema, bodyResult.data)
    if (validationError) return validationError

    // FIX MEDIUM: Preveri da izmena obstaja pred posodobitvijo
    const existing = await db.shift.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Izmena ni najdena' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (data.date !== undefined) updateData.date = new Date(data.date)
    if (data.startTime !== undefined) updateData.startTime = data.startTime
    if (data.endTime !== undefined) updateData.endTime = data.endTime
    if (data.status !== undefined) updateData.status = data.status
    if (data.jobId !== undefined) updateData.jobId = data.jobId || null
    if (data.breakMinutes !== undefined) updateData.breakMinutes = data.breakMinutes
    if (data.notes !== undefined) updateData.notes = data.notes

    const shift = await db.shift.update({
      where: { id },
      data: updateData,
      include: {
        employee: { select: { id: true, name: true, role: true } },
        job: { select: { id: true, name: true, basePayRate: true } },
      },
    })
    return NextResponse.json(shift)
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/shifts/[id]', 'Napaka pri posodobitvi izmene')
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const { id } = await params

    // FIX: Preveri da izmena obstaja pred brisanjem
    const shift = await db.shift.findUnique({ where: { id } })
    if (!shift) {
      return NextResponse.json({ error: 'Izmena ni najdena' }, { status: 404 })
    }

    // FIX MEDIUM: Soft-delete namesto hard-delete — ohrani evidenco za plačilne izračune
    await db.shift.update({ where: { id }, data: { status: 'cancelled' } })
    return NextResponse.json({ success: true, message: 'Izmena preklicana' })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/shifts/[id]', 'Napaka pri brisanju izmene')
  }
}
