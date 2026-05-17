import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, createMenuItemSchema } from '@/lib/validations'
import { z } from 'zod'

// Extend schema with modifierGroupIds (not part of base MenuItem schema)
const createMenuItemWithModifiersSchema = createMenuItemSchema.extend({
  modifierGroupIds: z.array(z.string().min(1)).default([]),
})

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const menuId = searchParams.get('menuId')

    let where = {}
    if (categoryId) {
      where = { categoryId }
    } else if (menuId) {
      where = { category: { menuId } }
    }

    const items = await db.menuItem.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        category: {
          include: { menu: { select: { id: true, name: true } } },
        },
        modifierGroups: {
          orderBy: { sortOrder: 'asc' },
          include: {
            modifierGroup: {
              include: {
                modifiers: {
                  where: { isAvailable: true },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
      },
    })
    return NextResponse.json(items)
  } catch (error) {
    console.error('Error fetching menu items:', error)
    return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    // Auth check
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    const body = await req.json()

    // Zod validation (includes modifierGroupIds)
    const { data, error: validationError } = validateBody(createMenuItemWithModifiersSchema, body)
    if (validationError) return validationError

    const { modifierGroupIds, ...itemData } = data

    const item = await db.menuItem.create({
      data: {
        name: itemData.name,
        description: itemData.description,
        price: itemData.price,
        image: itemData.image,
        isAvailable: itemData.isAvailable,
        sortOrder: 0,
        categoryId: itemData.categoryId,
        ...(modifierGroupIds?.length ? {
          modifierGroups: {
            create: modifierGroupIds.map((groupId: string, i: number) => ({
              modifierGroupId: groupId,
              sortOrder: i,
            })),
          },
        } : {}),
      },
      include: {
        category: true,
        modifierGroups: {
          include: {
            modifierGroup: { include: { modifiers: true } },
          },
        },
      },
    })
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('Error creating menu item:', error)
    return NextResponse.json({ error: 'Failed to create menu item' }, { status: 500 })
  }
}
