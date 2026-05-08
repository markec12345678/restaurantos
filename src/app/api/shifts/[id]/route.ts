import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const shift = await db.shift.update({
    where: { id },
    data: {
      date: body.date ? new Date(body.date) : undefined,
      startTime: body.startTime,
      endTime: body.endTime,
      status: body.status,
    },
    include: { employee: true },
  })
  return NextResponse.json(shift)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.shift.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
