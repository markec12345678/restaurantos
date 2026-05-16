import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody } from '@/lib/validations'

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
export async function GET(req: Request) {
  try {
    // Auth check — requires manage_inventory permission
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const menuItemId = searchParams.get('menuItemId')

    const where: Record<string, unknown> = {}
    if (menuItemId) where.menuItemId = menuItemId

    const recipes = await db.recipeItem.findMany({
      where,
      include: {
        menuItem: { select: { id: true, name: true, price: true } },
        inventoryItem: { select: { id: true, name: true, unit: true, costPerUnit: true, quantity: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Obogatitev s stroški na porcijo
    const enriched = recipes.map(r => ({
      ...r,
      costPerServing: r.quantityPerServing * r.inventoryItem.costPerUnit,
    }))

    return NextResponse.json(enriched)
  } catch (error) {
    console.error('Recipes GET error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju receptov' }, { status: 500 })
  }
}

// POST /api/recipes — Dodaj sestavino v recept
export async function POST(req: Request) {
  try {
    // Auth check
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    const body = await req.json()

    // Zod validation
    const { data, error: validationError } = validateBody(createRecipeSchema, body)
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

    return NextResponse.json(recipe)
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Ta sestavina je že dodana k temu artiklu' }, { status: 400 })
    }
    console.error('Recipes POST error:', error)
    return NextResponse.json({ error: 'Napaka pri dodajanju sestavine' }, { status: 500 })
  }
}

// PUT /api/recipes — Posodobi sestavino v receptu
export async function PUT(req: Request) {
  try {
    // Auth check
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    const body = await req.json()

    // Zod validation
    const { data, error: validationError } = validateBody(updateRecipeSchema, body)
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

    return NextResponse.json(recipe)
  } catch (error) {
    console.error('Recipes PUT error:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju sestavine' }, { status: 500 })
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
  } catch (error) {
    console.error('Recipes DELETE error:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju sestavine' }, { status: 500 })
  }
}
