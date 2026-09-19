
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { createModifierGroupSchema } from '@/lib/validations'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { resolveCatalogScope, locationFilter, resolveWriteLocationId } from '@/lib/tenant-scope'
import { dedupeIds, attachmentScopeDecision } from '@/lib/modifier-attach'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    const scopeRes = resolveCatalogScope(authResult)
    if (!scopeRes.ok) return scopeRes.response

    // MODEL A (#9 tenant scope audit 2026-09-09): skupine so PO LOKACIJI.
    // Prej: findMany BREZ where = izpis VSEH najemnikov (cross-tenant leak).
    const locWhere = locationFilter(scopeRes.scope)
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

    const scopeRes = resolveCatalogScope(authResult)
    if (!scopeRes.ok) return scopeRes.response

    // FIX SECURITY: validateRequest() prepreči DoS z oversized payload
    const { data, error: validationError } = await validateRequest(request, createModifierGroupSchema)
    if (validationError) return validationError

    // MODEL A (#9): lokacija se izpelje izključno iz seje (zaposleni) ali
    // izrecnega ?locationId= (admin brez dodeljene lokacije) — nikoli iz bodyja.
    const { searchParams } = new URL(request.url)
    const loc = resolveWriteLocationId(scopeRes.scope, searchParams.get('locationId'))
    if (!loc.ok) return loc.response

    // RUNDA 70: group-side attach — menuItemIds (prej validirana ampak TIHO
    // IGNORIRANA polja!). Artikli morajo pripadati ISTI lokaciji kot skupina
    // (veriga MenuItem → Category → Menu → locationId) — isti kontrakt kot
    // POST /api/menu-items modifierGroupIds (MODEL A #9).
    const requestedItemIds = dedupeIds(data.menuItemIds ?? [])
    let inScopeItemCount = 0
    if (requestedItemIds.length > 0) {
      const itemsInLocation = await db.menuItem.findMany({
        where: { id: { in: requestedItemIds }, category: { menu: { locationId: loc.locationId } } },
        select: { id: true },
      })
      inScopeItemCount = itemsInLocation.length
    }
    const attachDecision = attachmentScopeDecision(requestedItemIds.length, inScopeItemCount)
    if (!attachDecision.allowed) {
      return NextResponse.json({ error: attachDecision.messageSl }, { status: attachDecision.status })
    }

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
        // RUNDA 70: pripni artikle že ob ustvarjanju skupine
        ...(requestedItemIds.length > 0 && {
          menuItems: {
            create: requestedItemIds.map((menuItemId, i) => ({ menuItemId, sortOrder: i })),
          },
        }),
      },
      include: { modifiers: true, menuItems: { include: { menuItem: { select: { id: true, name: true } } } } },
    })
    return NextResponse.json(deepToNumbers(modifierGroup), { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/modifier-groups', 'Failed to create modifier group')
  }
}
