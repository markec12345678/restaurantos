import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const categories = await db.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { menuItems: true },
  })
  return NextResponse.json(categories)
}

export async function POST(req: Request) {
  const body = await req.json()
  const category = await db.category.create({
    data: {
      name: body.name,
      icon: body.icon || '🍽️',
      color: body.color || '#f59e0b',
      sortOrder: body.sortOrder || 0,
    },
  })
  return NextResponse.json(category)
}
