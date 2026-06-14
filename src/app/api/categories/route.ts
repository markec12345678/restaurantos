
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createCategorySchema } from '@/lib/validations'
import { handleApiError, validateRequest } from '@/lib/api-utils'
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
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/categories', 'Napaka pri pridobivanju kategorij')
  }
}

export async function POST(req: Request) {
  try {
    // Auth check
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    // FIX SECURITY: validateRequest() prepreči DoS z oversized payload
    const { data, error: validationError } = await validateRequest(req, createCategorySchema)
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
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/categories', 'Napaka pri ustvarjanju kategorije')
  }
}
