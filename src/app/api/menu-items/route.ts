// Extend schema with modifierGroupIds (not part of base MenuItem schema)
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { createMenuItemSchema } from '@/lib/validations'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { isItemAvailableNow } from '@/lib/mealtimes'

const createMenuItemWithModifiersSchema = createMenuItemSchema.extend({
  modifierGroupIds: z.array(z.string().min(1)).default([]),
})

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const menuId = searchParams.get('menuId')
    const limitParam = searchParams.get('limit')
    const offsetParam = searchParams.get('offset')
    const simple = searchParams.get('simple') // Skip heavy includes when true
    // AUD-10: omogoči MealtimeRule filtriranje (?checkMealtimes=true).
    // Ko je true, se artikli z ne-ujemajočimi pravili označijo z isAvailable=false
    // in (kadar ?hideUnavailable=1) izločijo iz seznama.
    const checkMealtimes = searchParams.get('checkMealtimes') === 'true'
    const hideUnavailable = searchParams.get('hideUnavailable') === '1'

    let where = {}
    if (categoryId) {
      where = { categoryId }
    } else if (menuId) {
      where = { category: { menuId } }
    }

    // FIX PERF: Paginacija + optional simple mode (brez modifierGroups za hitrejši response)
    const limit = Math.min(Number.isNaN(parseInt(limitParam || '')) ? 500 : parseInt(limitParam || ''), 500)
    const offset = Number.isNaN(parseInt(offsetParam || '')) ? 0 : parseInt(offsetParam || '')

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

    return NextResponse.json({ menuItems: deepToNumbers(items), total, limit, offset })
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
