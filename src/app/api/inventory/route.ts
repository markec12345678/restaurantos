import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, createInventorySchema } from '@/lib/validations'

export async function GET(req: Request) {
  try {
    // FIX: Zahtevaj avtentikacijo za branje zaloge
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const location = searchParams.get('location')
    const lowStock = searchParams.get('lowStock')
    const distinctCategories = searchParams.get('distinctCategories')
    const distinctLocations = searchParams.get('distinctLocations')
    // FIX LOW: Paginacija za zalogo — prepreči nalaganje tisočih zapisov
    const rawLimit = parseInt(searchParams.get('limit') || '500')
    const rawOffset = parseInt(searchParams.get('offset') || '0')
    const limit = Math.min(Number.isNaN(rawLimit) ? 500 : rawLimit, 2000)
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset

    // ─── Poseben endpoint: vrni vse distinktne kategorije ───
    if (distinctCategories === 'true') {
      const cats = await db.inventoryItem.findMany({
        select: { category: true },
        distinct: ['category'],
        orderBy: { category: 'asc' },
      })
      return NextResponse.json(cats.map(c => c.category))
    }

    // ─── Poseben endpoint: vrni vse distinktne lokacije ───
    if (distinctLocations === 'true') {
      const locs = await db.inventoryItem.findMany({
        select: { location: true },
        distinct: ['location'],
        orderBy: { location: 'asc' },
      })
      return NextResponse.json(locs.map(l => l.location))
    }

    // Zgradi filtrirne pogoje pravilno — AND kombinacija med kategorijo, lokacijo in iskanjem
    const andConditions: Record<string, unknown>[] = []

    if (category) {
      // FIX: Podpora za več kategorij (comma-separated)
      // SQLite ne podpira `mode: 'insensitive'` — uporabimo `contains` ali `equals` brez mode
      const categories = category.split(',').map(c => c.trim()).filter(Boolean)
      if (categories.length === 1) {
        andConditions.push({ category: { equals: categories[0] } })
      } else if (categories.length > 1) {
        andConditions.push({
          OR: categories.map(c => ({ category: { equals: c } }))
        })
      }
    }

    // FIX: Podpora za filtriranje po lokaciji/skladišču
    if (location) {
      const locations = location.split(',').map(l => l.trim()).filter(Boolean)
      if (locations.length === 1) {
        andConditions.push({ location: { equals: locations[0] } })
      } else if (locations.length > 1) {
        andConditions.push({
          OR: locations.map(l => ({ location: { equals: l } }))
        })
      }
    }

    // FIX: Podpora za iskanje po imenu — ne prepiše category OR-ja
    // SQLite: `contains` brez `mode: 'insensitive'` (SQLite je že case-insensitive za ASCII)
    const search = searchParams.get('search')
    if (search) {
      andConditions.push({
        OR: [
          { name: { contains: search } },
          { supplier: { contains: search } },
        ]
      })
    }

    // FIX HIGH: Low stock filter - Prisma/SQLite ne podpira cross-field comparison
    // Ko je lowStock=true, pridobi vse artikle brez paginacije, filtriraj v pomnilniku
    // in nato uporabi offset/limit na filtriranih rezultatih
    const fetchAll = lowStock === 'true'

    const where: Record<string, unknown> = andConditions.length > 1
      ? { AND: andConditions }
      : andConditions.length === 1
        ? andConditions[0]
        : {}

    const items = await db.inventoryItem.findMany({
      where,
      orderBy: { name: 'asc' },
      take: fetchAll ? undefined : limit,
      skip: fetchAll ? undefined : offset,
      include: {
        menuItem: { select: { id: true, name: true, price: true } },
      },
    })

    // Filter low stock items in memory (cross-field comparison ni podprto v Prisma/SQLite)
    let result = items
    let totalForPagination: number | undefined = undefined
    if (lowStock === 'true') {
      const filtered = items.filter((item) => item.quantity <= item.minQuantity)
      totalForPagination = filtered.length
      // Uporabi offset/limit na že filtriranih rezultatih
      result = filtered.slice(offset, offset + limit)
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

    // Vključi total za paginacijo (lowStock filter potrebuje pravilen total)
    const response: Record<string, unknown> = { items: itemsWithMeta }
    if (totalForPagination !== undefined) {
      response.total = totalForPagination
      response.limit = limit
      response.offset = offset
    }

    return NextResponse.json(response)
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
