import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/recipes — Pridobi recepte/normative
export async function GET(req: Request) {
  try {
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
    const body = await req.json()

    const recipe = await db.recipeItem.create({
      data: {
        menuItemId: body.menuItemId,
        inventoryItemId: body.inventoryItemId,
        quantityPerServing: body.quantityPerServing || 0,
        unit: body.unit || '',
        notes: body.notes || '',
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
    const body = await req.json()

    const recipe = await db.recipeItem.update({
      where: { id: body.id },
      data: {
        quantityPerServing: body.quantityPerServing,
        unit: body.unit,
        notes: body.notes,
      },
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
