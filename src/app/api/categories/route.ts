import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const menuId = searchParams.get('menuId')

    const where = menuId ? { menuId } : {}
    const categories = await db.category.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        menu: { select: { id: true, name: true } },
        menuItems: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })
    return NextResponse.json(categories)
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const category = await db.category.create({
      data: {
        name: body.name,
        icon: body.icon || '🍽️',
        color: body.color || '#f59e0b',
        sortOrder: body.sortOrder || 0,
        menuId: body.menuId,
      },
    })
    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error('Error creating category:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
