
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { createModifierGroupSchema } from '@/lib/validations'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { sessionLocationId, locationFilter, resolveWriteLocationId } from '@/lib/tenant-scope'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    // MODEL A (#9 tenant scope audit 2026-09-09): skupine so PO LOKACIJI.
    // Prej: findMany BREZ where = izpis VSEH najemnikov (cross-tenant leak).
    const locWhere = locationFilter(sessionLocationId(authResult))
    const modifierGroups = await db.modifierGroup.findMany({
      where: locWhere,
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
    return NextResponse.json(deepToNumbers(modifierGroups))
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

    // MODEL A (#9): lokacija se izpelje izključno iz seje (zaposleni) ali
    // izrecnega ?locationId= (admin brez dodeljene lokacije) — nikoli iz bodyja.
    const { searchParams } = new URL(request.url)
    const loc = resolveWriteLocationId(sessionLocationId(authResult), searchParams.get('locationId'))
    if (!loc.ok) return loc.response

    const modifierGroup = await db.modifierGroup.create({
      data: {
        name: data.name,
        required: data.required,
        minSelect: data.minSelect,
        maxSelect: data.maxSelect ?? null,
        sortOrder: data.sortOrder,
        locationId: loc.locationId,
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
