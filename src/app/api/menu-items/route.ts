// Extend schema with modifierGroupIds (not part of base MenuItem schema)
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { createMenuItemSchema } from '@/lib/validations'
import { z } from 'zod'
import { handleApiError, validateRequest, parsePaginationParams, BULK_MAX_LIMIT } from '@/lib/api-utils'
import { isItemAvailableNow } from '@/lib/mealtimes'
import { withETag } from '@/lib/middleware/cache-headers'
import { sessionLocationId, menuItemLocationFilter, isWithinScope, notInScopeResponse } from '@/lib/tenant-scope'

const createMenuItemWithModifiersSchema = createMenuItemSchema.extend({
  modifierGroupIds: z.array(z.string().min(1)).default([]),
})

export const dynamic = 'force-dynamic'
// FIX NAPAKA 5 (HTTP 503): Menu-items z modifierGroups include je lahko počasen.
export const maxDuration = 30

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const menuId = searchParams.get('menuId')

    const simple = searchParams.get('simple') // Skip heavy includes when true
    // AUD-10: omogoči MealtimeRule filtriranje (?checkMealtimes=true).
    // Ko je true, se artikli z ne-ujemajočimi pravili označijo z isAvailable=false
    // in (kadar ?hideUnavailable=1) izločijo iz seznama.
    const checkMealtimes = searchParams.get('checkMealtimes') === 'true'
    const hideUnavailable = searchParams.get('hideUnavailable') === '1'

    // MODEL A: artikel NIMA lastnega locationId — scope prek Category → Menu.
    // Prej: neufiltrirano = artikel KATEREKOLI lokacije/najemnika!
    const scope = sessionLocationId(authResult)
    let where: Record<string, unknown> = { ...menuItemLocationFilter(scope) }
    if (categoryId) {
      where = { ...where, categoryId }
    } else if (menuId) {
      where = { ...where, category: { ...(where.category as Record<string, unknown> || {}), menuId } }
    }

    // FIX PERF: Paginacija + optional simple mode (brez modifierGroups za hitrejši response)
    // P1-16: centralna pagination validacija — maxLimit 500 (BULK) je utemeljen,
    // ker POS meni browser naloži CELOTEN jedilnik naenkrat (tudi nutrition calc
    // in AI priporočila pridobivajo celoten meni z limit=500)
    const { limit, offset } = parsePaginationParams(searchParams, { defaultLimit: BULK_MAX_LIMIT, maxLimit: BULK_MAX_LIMIT })

    // AUD-10: dodaj mealtimeRules v include, da lahko filtriramo po dnevu/času
    const include = (simple === 'true'
      ? {
          category: { select: { id: true, name: true, menuId: true } },
          mealtimeRules: { select: { daysOfWeek: true, timeFrom: true, timeTo: true, isActive: true } },
        }
      : {
          category: {
            include: { menu: { select: { id: true, name: true } } },
          },
          modifierGroups: {
            orderBy: { sortOrder: 'asc' as const },
            include: {
              modifierGroup: {
                include: {
                  modifiers: {
                    where: { isAvailable: true },
                    orderBy: { sortOrder: 'asc' as const },
                  },
                },
              },
            },
          },
          mealtimeRules: {
            select: { daysOfWeek: true, timeFrom: true, timeTo: true, isActive: true },
            orderBy: { sortOrder: 'asc' as const },
          },
        }
    )

    const [itemsRaw, total] = await Promise.all([
      db.menuItem.findMany({
        where,
        orderBy: { sortOrder: 'asc' as const },
        take: limit,
        skip: offset,
        include,
      }),
      db.menuItem.count({ where }),
    ])

    // AUD-10: filtriraj glede na mealtimeRules. Če checkMealtimes=false → vsi artikli
    // ostanejo na voljo (default behavior, backward compatible).
    const now = new Date()
    const items = checkMealtimes
      ? itemsRaw
          .map((item) => {
            // Prisili tip — mealtimeRules pride iz include-ja zgoraj
            const rules = (item as { mealtimeRules?: Array<{ daysOfWeek: string; timeFrom: string; timeTo: string; isActive: boolean }> }).mealtimeRules || []
            const available = isItemAvailableNow(rules, now)
            return { ...item, isAvailable: available }
          })
          .filter((item) => !hideUnavailable || item.isAvailable)
      : itemsRaw

    const responseBody = { menuItems: deepToNumbers(items), total, limit, offset }
    // FIX P15: ETag za menu-items — prepreči redundantne DB query-je
    return withETag(request, NextResponse.json(responseBody), responseBody)
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/menu-items', 'Failed to fetch menu items')
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { data, error: validationError } = await validateRequest(req, createMenuItemWithModifiersSchema)
    if (validationError) return validationError

    const { modifierGroupIds, ...itemData } = data

    // MODEL A: artikel pade POD kategorijo — preveri verigo Category → Menu →
    // Location proti scope-u seje (prej: artikel katerokoli lokacije!).
    const parentCategory = await db.category.findUnique({
      where: { id: itemData.categoryId },
      select: { id: true, menu: { select: { id: true, locationId: true } } },
    })
    if (!parentCategory || !isWithinScope(sessionLocationId(authResult), parentCategory.menu.locationId)) {
      return notInScopeResponse('Kategorija')
    }

    // MODEL A (#9): modifierGroupIds morajo pripadati ISTI lokaciji kot meni
    // artikla (prej: skupino katerekoli lokacije je bilo mogoče pripeti).
    if (modifierGroupIds.length > 0) {
      const uniqueIds = [...new Set(modifierGroupIds)]
      const groupsInLocation = await db.modifierGroup.findMany({
        where: { id: { in: uniqueIds }, locationId: parentCategory.menu.locationId },
        select: { id: true },
      })
      if (groupsInLocation.length !== uniqueIds.length) {
        return notInScopeResponse('Skupina modifikatorjev')
      }
    }

    const item = await db.menuItem.create({
      data: {
        ...itemData,
        modifierGroups: modifierGroupIds.length > 0
          ? { create: modifierGroupIds.map((id: string, idx: number) => ({ modifierGroupId: id, sortOrder: idx })) }
          : undefined,
      },
      include: { category: true },
    })

    return NextResponse.json(deepToNumbers(item), { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/menu-items', 'Failed to create menu item')
  }
}
