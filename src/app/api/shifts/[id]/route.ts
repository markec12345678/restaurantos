import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, updateShiftSchema } from '@/lib/validations'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const body = await req.json()

    // FIX: Zod validacija namesto ročnega preslikavanja
    const { data, error: validationError } = validateBody(updateShiftSchema, body)
    if (validationError) return validationError

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
  } catch (error) {
    console.error('Napaka pri posodobitvi izmene:', error)
    return NextResponse.json({ error: 'Napaka pri posodobitvi izmene' }, { status: 500 })
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

    await db.shift.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Napaka pri brisanju izmene:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju izmene' }, { status: 500 })
  }
}
