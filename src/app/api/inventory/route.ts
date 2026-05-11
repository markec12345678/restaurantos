import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, createInventorySchema } from '@/lib/validations'

export async function GET(req: Request) {
  try {
    // GET je javno dostopen za prikaz na blagajni
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const lowStock = searchParams.get('lowStock')

    const where: Record<string, unknown> = {}
    if (category) where.category = category

    const items = await db.inventoryItem.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        menuItem: { select: { id: true, name: true, price: true } },
      },
    })

    // Filter low stock items in memory (avoids complex SQL comparison)
    let result = items
    if (lowStock === 'true') {
      result = items.filter((item) => item.quantity <= item.minQuantity)
    }

    // Pridobi zadnje transakcije za vse artikle naenkrat (brez N+1)
    const itemIds = result.map((item) => item.id)

    const [txCounts, lastTransactions] = await Promise.all([
      db.stockTransaction.groupBy({
        by: ['inventoryItemId'],
        where: { inventoryItemId: { in: itemIds } },
        _count: true,
      }),
      db.stockTransaction.findMany({
        where: { inventoryItemId: { in: itemIds } },
        orderBy: { createdAt: 'desc' },
        distinct: ['inventoryItemId'],
        select: { inventoryItemId: true, createdAt: true, type: true },
      }),
    ])

    const countMap = new Map(txCounts.map((t) => [t.inventoryItemId, t._count]))
    const lastTxMap = new Map(lastTransactions.map((t) => [t.inventoryItemId, t]))

    const itemsWithMeta = result.map((item) => ({
      ...item,
      _txCount: countMap.get(item.id) || 0,
      _lastTransaction: lastTxMap.get(item.id) || null,
    }))

    return NextResponse.json(itemsWithMeta)
  } catch (error) {
    console.error('Napaka pri pridobivanju zaloge:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju zaloge' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    // FIX BUG 9: Zahtevaj avtentikacijo za ustvarjanje zaloge
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX BUG 9: Zod validacija
    const { data, error: validationError } = validateBody(createInventorySchema, body)
    if (validationError) return validationError

    const costPerServing = data.servingsPerUnit > 0
      ? Math.round((data.costPerUnit / data.servingsPerUnit) * 100) / 100
      : 0

    const item = await db.inventoryItem.create({
      data: {
        name: data.name,
        description: data.description,
        image: '',
        unit: data.unit,
        quantity: data.quantity,
        minQuantity: data.minQuantity,
        costPerUnit: data.costPerUnit,
        supplier: data.supplier,
        category: data.category,
        expiryDate: null,
        servingsPerUnit: data.servingsPerUnit,
        servingSize: data.servingSize,
        costPerServing,
        menuItemId: data.menuItemId || null,
        lastRestocked: new Date(),
      },
      include: { menuItem: true },
    })

    // Ustvari začetno transakcijo če je količina > 0
    if (item.quantity > 0) {
      await db.stockTransaction.create({
        data: {
          inventoryItemId: item.id,
          type: 'procurement',
          quantity: item.quantity,
          previousQty: 0,
          newQty: item.quantity,
          costPerUnit: item.costPerUnit,
          totalCost: item.quantity * item.costPerUnit,
          reason: 'Začetna zaloga',
          employeeName: authResult.session?.employeeId || '',
        },
      })
    }

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('Napaka pri ustvarjanju zaloge:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju zaloge' }, { status: 500 })
  }
}
