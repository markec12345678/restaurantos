import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const items = await db.menuItem.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { category: true },
  })
  return NextResponse.json(items)
}

export async function POST(req: Request) {
  const body = await req.json()
  const item = await db.menuItem.create({
    data: {
      name: body.name,
      description: body.description || '',
      price: body.price,
      image: body.image || '',
      isAvailable: body.isAvailable ?? true,
      sortOrder: body.sortOrder || 0,
      categoryId: body.categoryId,
    },
    include: { category: true },
  })
  return NextResponse.json(item)
}
