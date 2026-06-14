
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { createModifierGroupSchema } from '@/lib/validations'
import { NextResponse } from 'next/server'
import { handleApiError, validateRequest } from '@/lib/api-utils'
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    const modifierGroups = await db.modifierGroup.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        modifiers: { orderBy: { sortOrder: 'asc' } },
        menuItems: {
          include: {
            menuItem: { select: { id: true, name: true } },
          },
        },
      },
    })
    return NextResponse.json(modifierGroups)
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/modifier-groups', 'Failed to fetch modifier groups')
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth(request, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // FIX SECURITY: validateRequest() prepreči DoS z oversized payload
    const { data, error: validationError } = await validateRequest(request, createModifierGroupSchema)
    if (validationError) return validationError

    const modifierGroup = await db.modifierGroup.create({
      data: {
        name: data.name,
        required: data.required,
        minSelect: data.minSelect,
        maxSelect: data.maxSelect ?? null,
        sortOrder: data.sortOrder,
        modifiers: {
          create: (data.modifiers || []).map((m, i) => ({
            name: m.name,
            price: m.price,
            sortOrder: m.sortOrder ?? i,
          })),
        },
      },
      include: { modifiers: true },
    })
    return NextResponse.json(modifierGroup, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/modifier-groups', 'Failed to create modifier group')
  }
}
