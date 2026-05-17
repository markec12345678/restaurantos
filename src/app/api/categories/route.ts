import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody } from '@/lib/validations'

const createCategorySchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(100),
  icon: z.string().max(10).default('🍽️'),
  color: z.string().max(20).default('#f59e0b'),
  sortOrder: z.number().int().min(0).default(0),
  menuId: z.string().min(1, 'menuId je obvezen'),
})

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) return authResult.error

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
    // Auth check
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    const body = await req.json()

    // Zod validation
    const { data, error: validationError } = validateBody(createCategorySchema, body)
    if (validationError) return validationError

    const category = await db.category.create({
      data: {
        name: data.name,
        icon: data.icon,
        color: data.color,
        sortOrder: data.sortOrder,
        menuId: data.menuId,
      },
    })
    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error('Error creating category:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
