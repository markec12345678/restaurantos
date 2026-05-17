import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { NextResponse } from 'next/server'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const body = await req.json()

    const updateData: Record<string, unknown> = {}

    // Clock-out support
    if (body.clockOut !== undefined) {
      updateData.clockOut = body.clockOut ? new Date(body.clockOut) : new Date()
    }
    if (body.breakStart !== undefined) updateData.breakStart = body.breakStart ? new Date(body.breakStart) : null
    if (body.breakEnd !== undefined) updateData.breakEnd = body.breakEnd ? new Date(body.breakEnd) : null
    if (body.breakMinutes !== undefined) updateData.breakMinutes = body.breakMinutes
    if (body.totalMinutes !== undefined) updateData.totalMinutes = body.totalMinutes
    if (body.payRate !== undefined) updateData.payRate = body.payRate
    if (body.totalPay !== undefined) updateData.totalPay = body.totalPay
    if (body.type !== undefined) updateData.type = body.type
    if (body.status !== undefined) updateData.status = body.status
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.jobId !== undefined) updateData.jobId = body.jobId || null

    // Auto-calculate totalMinutes and totalPay on clock-out
    if (body.clockOut !== undefined && !body.totalMinutes) {
      const entry = await db.timeEntry.findUnique({ where: { id } })
      if (entry) {
        const clockOutTime = updateData.clockOut as Date
        const diffMs = clockOutTime.getTime() - entry.clockIn.getTime()
        const totalMinutes = Math.floor(diffMs / 60000) - (body.breakMinutes || entry.breakMinutes)
        updateData.totalMinutes = Math.max(0, totalMinutes)
        const payRate = body.payRate !== undefined ? body.payRate : entry.payRate
        updateData.totalPay = Math.round((Math.max(0, totalMinutes) / 60) * payRate * 100) / 100
      }
    }

    const timeEntry = await db.timeEntry.update({
      where: { id },
      data: updateData,
      include: {
        employee: { select: { id: true, name: true } },
        job: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(timeEntry)
  } catch (error) {
    console.error('Failed to update time entry:', error)
    return NextResponse.json({ error: 'Failed to update time entry' }, { status: 500 })
  }
}
