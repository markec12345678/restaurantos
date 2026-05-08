import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const table = await db.table.update({
    where: { id },
    data: {
      number: body.number,
      capacity: body.capacity,
      status: body.status,
      area: body.area,
    },
  })
  return NextResponse.json(table)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.table.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
