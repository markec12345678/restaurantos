import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const tables = await db.table.findMany({
    orderBy: { number: 'asc' },
    include: { orders: { where: { status: { in: ['pending', 'in-progress', 'ready'] } }, take: 1 } },
  })
  return NextResponse.json(tables)
}

export async function POST(req: Request) {
  const body = await req.json()
  const table = await db.table.create({
    data: {
      number: body.number,
      capacity: body.capacity || 4,
      status: body.status || 'available',
      area: body.area || 'main',
    },
  })
  return NextResponse.json(table)
}
