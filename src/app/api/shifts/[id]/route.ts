import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const updateData: Record<string, unknown> = {}
  if (body.date !== undefined) updateData.date = new Date(body.date)
  if (body.startTime !== undefined) updateData.startTime = body.startTime
  if (body.endTime !== undefined) updateData.endTime = body.endTime
  if (body.status !== undefined) updateData.status = body.status
  if (body.jobId !== undefined) updateData.jobId = body.jobId || null
  if (body.breakMinutes !== undefined) updateData.breakMinutes = body.breakMinutes
  if (body.notes !== undefined) updateData.notes = body.notes

  const shift = await db.shift.update({
    where: { id },
    data: updateData,
    include: {
      employee: { select: { id: true, name: true, role: true } },
      job: { select: { id: true, name: true, basePayRate: true } },
    },
  })
  return NextResponse.json(shift)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.shift.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
