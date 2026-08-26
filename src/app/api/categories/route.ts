
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { createCategorySchema } from '@/lib/validations'
import { handleApiError, validateRequest } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(request.url)
    const menuId = searchParams.get('menuId')
    const includeItems = searchParams.get('includeItems') !== 'false' // default true
    const rawLimit = parseInt(searchParams.get('limit') || '200')
    const rawOffset = parseInt(searchParams.get('offset') || '0')
    const limit = Math.min(Number.isNaN(rawLimit) ? 200 : rawLimit, 500)
    const offset = Math.max(Number.isNaN(rawOffset) ? 0 : rawOffset, 0)

    const where = menuId ? { menuId } : {}
    const [categories, total] = await Promise.all([
      db.category.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        include: {
          menu: { select: { id: true, name: true } },
          // FIX: `menuItems` include je drag — za velike menije lahko vrne 1000+ vrstic.
          // Dodaj query param `?includeItems=false` za lightweight listing (samo kategorije).
          ...(includeItems
            ? { menuItems: { orderBy: { sortOrder: 'asc' } } }
            : { _count: { select: { menuItems: true } } }
          ),
        },
        take: limit,
        skip: offset,
      }),
      db.category.count({ where }),
    ])
    return NextResponse.json({ categories: deepToNumbers(categories), total, limit, offset })
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
