
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { updateTimeEntrySchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { NextResponse } from 'next/server'
import { toNum, round2, multiply, deepToNumbers } from '@/lib/decimal'
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX HIGH: Zod validacija za posodobitev časovnega vnosa
    const { data, error: validationError } = validateBody(updateTimeEntrySchema, bodyResult.data)
    if (validationError) return validationError

    // FIX MEDIUM: Preveri da časovni vnos obstaja pred posodobitvijo
    const existingEntry = await db.timeEntry.findUnique({ where: { id } })
    if (!existingEntry) {
      return NextResponse.json({ error: 'Časovni vnos ni najden' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    // Clock-out support
    if (data.clockOut !== undefined) {
      updateData.clockOut = data.clockOut ? new Date(data.clockOut) : new Date()
    }
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.payRate !== undefined) updateData.payRate = data.payRate

    // Auto-calculate totalMinutes and totalPay on clock-out
    // FIX MEDIUM: Vedno izračunaj totalPay iz payRate × ure — prepreči plačno goljufijo
    if (data.clockOut !== undefined) {
      const clockOutTime = updateData.clockOut as Date
      const diffMs = clockOutTime.getTime() - existingEntry.clockIn.getTime()
      const totalMinutes = Math.floor(diffMs / 60000) - (existingEntry.breakMinutes || 0)
      updateData.totalMinutes = Math.max(0, totalMinutes)
      const payRate = data.payRate !== undefined ? data.payRate : toNum(existingEntry.payRate)
      updateData.totalPay = Math.round((Math.max(0, totalMinutes) / 60) * payRate * 100) / 100
    } else if (data.payRate !== undefined) {
      // FIX HIGH: Preračunaj totalPay, če se payRate spremeni
      const clockOutTime = existingEntry.clockOut ? new Date(existingEntry.clockOut) : new Date()
      const totalMinutes = Math.max(0, Math.floor((clockOutTime.getTime() - existingEntry.clockIn.getTime()) / 60000) - (existingEntry.breakMinutes || 0))
      updateData.totalMinutes = totalMinutes
      updateData.totalPay = round2(multiply(totalMinutes / 60, data.payRate))
    }

    const timeEntry = await db.timeEntry.update({
      where: { id },
      data: updateData,
      include: {
        employee: { select: { id: true, name: true } },
        job: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(deepToNumbers(timeEntry))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/time-entries/[id]', 'Napaka pri posodabljanju časovnega vnosa')
  }
}
