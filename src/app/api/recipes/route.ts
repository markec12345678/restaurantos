
import { db } from '@/lib/db'
import { deepToNumbers, toNum } from '@/lib/decimal'
import { yieldAdjustedLineCost, rawFromUsable } from '@/lib/recipes/yield'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { isWithinScope, notInScopeResponse } from '@/lib/tenant-scope'
import { logger } from '@/lib/logger'
import { handleApiError, parseJsonBody, parsePaginationParams, validateBody } from '@/lib/api-utils'

const createRecipeSchema = z.object({
  menuItemId: z.string().min(1, 'menuItemId je obvezen'),
  inventoryItemId: z.string().min(1, 'inventoryItemId je obvezen'),
  quantityPerServing: z.number().positive('Količina mora biti pozitivna'),
  // R123 (epic #115 P0-05): deklarirani yield % sestavine (1–100; 100 = brez izgube)
  yieldPercent: z.number().min(1, 'Yield mora biti vsaj 1%').max(100, 'Yield ne more presegati 100%').default(100),
  unit: z.string().max(30).default(''),
  notes: z.string().max(500).default(''),
})

const updateRecipeSchema = z.object({
  id: z.string().min(1, 'ID je obvezen'),
  quantityPerServing: z.number().positive().optional(),
  // R123 (P0-05): yield % (1–100) — fail-closed validacija
  yieldPercent: z.number().min(1, 'Yield mora biti vsaj 1%').max(100, 'Yield ne more presegati 100%').optional(),
  unit: z.string().max(30).optional(),
  notes: z.string().max(500).optional(),
})

// GET /api/recipes — Pridobi recepte/normative
// FIX: dodana paginacija (prej je vrnil vse vrstice z globokimi includes —
// za 500 menu item-ov × 5 sestavin = 2500 vrstic + 5000 nested v vsakem zahtevku)
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // Auth check — requires manage_inventory permission
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const menuItemId = searchParams.get('menuItemId')
    const inventoryItemId = searchParams.get('inventoryItemId')
    // P1-16: centralna pagination validacija (limit max, offset, search dolžina)
    const { limit, offset } = parsePaginationParams(searchParams)

    // FIX R80 (MEDIUM): findMany + count BREZ tenant pota — manage_inventory je
    // videl stroške receptur tujih tenantov. RecipeItem NIMA locationId —
    // scope gre prek verige menuItem → category → menu.locationId (MODEL A:
    // Menu.locationId NOT NULL). Super-admin (null) = globalno.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/recipes',
    })
    if ('error' in scope) return scope.error

    const where: Record<string, unknown> = {}
    if (menuItemId) where.menuItemId = menuItemId
    if (inventoryItemId) where.inventoryItemId = inventoryItemId
    if (scope.locationId) {
      where.menuItem = { category: { menu: { locationId: scope.locationId } } }
    }

    const [recipes, total] = await Promise.all([
      db.recipeItem.findMany({
        where,
        include: {
          menuItem: { select: { id: true, name: true, price: true } },
          inventoryItem: { select: { id: true, name: true, unit: true, costPerUnit: true, quantity: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.recipeItem.count({ where }),
    ])

    // Obogatitev s stroški na porcijo
    const enriched = recipes.map(r => ({
      ...r,
      // R123 (P0-05): efektivni strošek = RAW × nabavna cena (usable × cena / yield%)
      costPerServing: yieldAdjustedLineCost(toNum(r.quantityPerServing), toNum(r.inventoryItem.costPerUnit), toNum(r.yieldPercent)),
      rawQuantityPerServing: rawFromUsable(toNum(r.quantityPerServing), toNum(r.yieldPercent)),
    }))

    return NextResponse.json({ recipes: deepToNumbers(enriched), total, limit, offset })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/recipes', 'Napaka pri pridobivanju receptov')
  }
}

// POST /api/recipes — Dodaj sestavino v recept
export async function POST(req: Request) {
  try {
    // Auth check
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // Zod validation
    const { data, error: validationError } = validateBody(createRecipeSchema, bodyResult.data)
    if (validationError) return validationError

    // FIX R80 (WRITE IDOR): create po raw menuItemId BREZ scope checka — staff
    // je lahko dodajal sestavine receptom TUJIH tenantov. Naloži referencirani
    // artikel v scope-u (veriga category → menu.locationId); izven → 404.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, null, {
      endpoint: 'POST /api/recipes',
    })
    if ('error' in scope) return scope.error

    const menuItem = await db.menuItem.findFirst({
      where: {
        id: data.menuItemId,
        ...(scope.locationId ? { category: { menu: { locationId: scope.locationId } } } : {}),
      },
      select: { id: true },
    })
    if (!menuItem) {
      return notInScopeResponse('Artikel')
    }

    const recipe = await db.recipeItem.create({
      data: {
        menuItemId: data.menuItemId,
        inventoryItemId: data.inventoryItemId,
        quantityPerServing: data.quantityPerServing,
        yieldPercent: data.yieldPercent,
        unit: data.unit,
        notes: data.notes,
      },
      include: {
        menuItem: { select: { name: true, price: true } },
        inventoryItem: { select: { name: true, unit: true, costPerUnit: true } },
      },
    })

    return NextResponse.json(deepToNumbers(recipe))
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Ta sestavina je že dodana k temu artiklu' }, { status: 400 })
    }
    logger.error('API', 'Recipes POST error:', error)
    return NextResponse.json({ error: 'Napaka pri dodajanju sestavine' }, { status: 500 })
  }
}

// PUT /api/recipes — Posodobi sestavino v receptu
export async function PUT(req: Request) {
  try {
    // Auth check
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // Zod validation
    const { data, error: validationError } = validateBody(updateRecipeSchema, bodyResult.data)
    if (validationError) return validationError

    // FIX R80 (WRITE IDOR): update po raw ID BREZ scope checka. Naloži recept z
    // lokacijo prek menuItem → category → menu in izvrši scope check.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, null, {
      endpoint: 'PUT /api/recipes',
    })
    if ('error' in scope) return scope.error

    const existingRecipe = await db.recipeItem.findUnique({
      where: { id: data.id },
      select: {
        id: true,
        menuItem: { select: { category: { select: { menu: { select: { locationId: true } } } } } },
      },
    })
    if (!existingRecipe) {
      return notInScopeResponse('Recept')
    }
    if (!isWithinScope(scope.locationId, existingRecipe.menuItem.category.menu.locationId)) {
      return notInScopeResponse('Recept')
    }

    const updateData: Record<string, unknown> = {}
    if (data.quantityPerServing !== undefined) updateData.quantityPerServing = data.quantityPerServing
    // R123 (P0-05): yield % posodobitev
    if (data.yieldPercent !== undefined) updateData.yieldPercent = data.yieldPercent
    if (data.unit !== undefined) updateData.unit = data.unit
    if (data.notes !== undefined) updateData.notes = data.notes

    const recipe = await db.recipeItem.update({
      where: { id: data.id },
      data: updateData,
      include: {
        menuItem: { select: { name: true, price: true } },
        inventoryItem: { select: { name: true, unit: true, costPerUnit: true } },
      },
    })

    return NextResponse.json(deepToNumbers(recipe))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/recipes', 'Napaka pri posodabljanju sestavine')
  }
}

// DELETE /api/recipes — Izbriši sestavino iz recepta
export async function DELETE(req: Request) {
  try {
    // Auth check
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Potreben je ID recepta' }, { status: 400 })
    }

    // FIX R80 (WRITE IDOR): delete po raw ID BREZ scope checka — isti vzorec kot PUT.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, null, {
      endpoint: 'DELETE /api/recipes',
    })
    if ('error' in scope) return scope.error

    const existingRecipe = await db.recipeItem.findUnique({
      where: { id },
      select: {
        id: true,
        menuItem: { select: { category: { select: { menu: { select: { locationId: true } } } } } },
      },
    })
    if (!existingRecipe) {
      return notInScopeResponse('Recept')
    }
    if (!isWithinScope(scope.locationId, existingRecipe.menuItem.category.menu.locationId)) {
      return notInScopeResponse('Recept')
    }

    await db.recipeItem.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/recipes', 'Napaka pri brisanju sestavine')
  }
}
