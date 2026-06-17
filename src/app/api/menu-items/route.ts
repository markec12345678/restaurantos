
// Extend schema with modifierGroupIds (not part of base MenuItem schema)
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createMenuItemSchema } from '@/lib/validations'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'

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
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/menu-items', 'Failed to fetch menu items')
  }
}

export async function POST(req: Request) {
  try {
    // Auth check
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    // FIX SECURITY: validateRequest() prepreči DoS z oversized payload
    const { data, error: validationError } = await validateRequest(req, createMenuItemWithModifiersSchema)
    if (validationError) return validationError

    const { modifierGroupIds, ...itemData } = data

    const item = await db.menuItem.create({
      data: {
        name: itemData.name,
        description: itemData.description,
        price: itemData.price,
        image: itemData.image,
        isAvailable: itemData.isAvailable,
        // FIX A6 MEDIUM: allergens in vatRate MANJKALA v create klicu — novi artikli so imeli prazne alergene
        allergens: itemData.allergens || '',
        vatRate: itemData.vatRate ?? 22.0,
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
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/menu-items', 'Failed to create menu item')
  }
}
