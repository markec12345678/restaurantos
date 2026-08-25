
import { db } from '@/lib/db'
import { deepToNumbers, toNum, multiply } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'

const createRecipeSchema = z.object({
  menuItemId: z.string().min(1, 'menuItemId je obvezen'),
  inventoryItemId: z.string().min(1, 'inventoryItemId je obvezen'),
  quantityPerServing: z.number().positive('Količina mora biti pozitivna'),
  unit: z.string().max(30).default(''),
  notes: z.string().max(500).default(''),
})

const updateRecipeSchema = z.object({
  id: z.string().min(1, 'ID je obvezen'),
  quantityPerServing: z.number().positive().optional(),
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
    const rawLimit = parseInt(searchParams.get('limit') || '200')
    const rawOffset = parseInt(searchParams.get('offset') || '0')
    const limit = Math.min(Number.isNaN(rawLimit) ? 200 : rawLimit, 500)
    const offset = Math.max(Number.isNaN(rawOffset) ? 0 : rawOffset, 0)

    const where: Record<string, unknown> = {}
    if (menuItemId) where.menuItemId = menuItemId
    if (inventoryItemId) where.inventoryItemId = inventoryItemId

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
      costPerServing: toNum(multiply(r.quantityPerServing, r.inventoryItem.costPerUnit)),
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

    const recipe = await db.recipeItem.create({
      data: {
        menuItemId: data.menuItemId,
        inventoryItemId: data.inventoryItemId,
        quantityPerServing: data.quantityPerServing,
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

    const updateData: Record<string, unknown> = {}
    if (data.quantityPerServing !== undefined) updateData.quantityPerServing = data.quantityPerServing
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

    await db.recipeItem.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/recipes', 'Napaka pri brisanju sestavine')
  }
}
