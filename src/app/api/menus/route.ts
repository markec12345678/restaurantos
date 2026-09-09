
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { createMenuSchema } from '@/lib/validations'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { sessionLocationId, locationFilter, resolveWriteLocationId } from '@/lib/tenant-scope'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    // MODEL A (tenant scope audit): meniji so PO LOKACIJI — zaposleni vidi SAMO
    // svoje (prej: vsi meniji vseh lokacij/najemnikov!). Admin brez lokacije vidi vse.
    const scope = sessionLocationId(authResult)
    const menus = await db.menu.findMany({
      where: locationFilter(scope),
      orderBy: { sortOrder: 'asc' },
      include: {
        categories: {
          orderBy: { sortOrder: 'asc' },
          include: {
            menuItems: {
              where: { isAvailable: true },
              orderBy: { sortOrder: 'asc' },
              include: {
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
            },
          },
        },
      },
    })
    return NextResponse.json(deepToNumbers(menus))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/menus', 'Napaka pri pridobivanju menijev')
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth(request, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // FIX SECURITY: validateRequest() prepreči DoS z oversized payload
    const { data, error: validationError } = await validateRequest(request, createMenuSchema)
    if (validationError) return validationError

    // MODEL A: Menu.locationId je NOT NULL — lokacija iz seje (zaposleni) ali
    // izrecno ?locationId= (admin brez dodeljene lokacije). Brez obeh = 400.
    const { searchParams } = new URL(request.url)
    const loc = resolveWriteLocationId(sessionLocationId(authResult), searchParams.get('locationId'))
    if (!loc.ok) return loc.response

    const menu = await db.menu.create({
      data: {
        name: data.name,
        icon: data.icon,
        color: data.color,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
        locationId: loc.locationId,
      },
    })
    return NextResponse.json(menu, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/menus', 'Napaka pri ustvarjanju menija')
  }
}
