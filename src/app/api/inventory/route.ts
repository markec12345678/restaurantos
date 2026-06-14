
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createInventorySchema } from '@/lib/validations'
import { toNum, round2, isPositive, greaterThan, multiply, deepToNumbers } from '@/lib/decimal'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleApiError, validateRequest } from '@/lib/api-utils'
export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('inventory', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

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
    // FIX MEDIUM: Add hard cap for lowStock fetch to prevent memory pressure
    const fetchAll = lowStock === 'true'

    const where: Record<string, unknown> = andConditions.length > 1
      ? { AND: andConditions }
      : andConditions.length === 1
        ? andConditions[0]
        : {}

    const items = await db.inventoryItem.findMany({
      where,
      orderBy: { name: 'asc' },
      take: fetchAll ? 5000 : limit, // FIX MEDIUM: Hard cap at 5000 for lowStock fetch
      skip: fetchAll ? undefined : offset,
      include: {
        menuItem: { select: { id: true, name: true, price: true } },
      },
    })

    // Filter low stock items in memory (cross-field comparison ni podprto v Prisma/SQLite)
    let result = items
    let totalForPagination: number | undefined = undefined
    if (lowStock === 'true') {
      const filtered = items.filter((item) => !greaterThan(item.quantity, item.minQuantity))
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

    return NextResponse.json(deepToNumbers(response))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/inventory', 'Napaka pri pridobivanju zaloge')
  }
}

export async function POST(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('inventory', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    // FIX BUG 9: Zahtevaj avtentikacijo za ustvarjanje zaloge
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    // FIX SECURITY: validateRequest() prepreči DoS z oversized payload
    const { data, error: validationError } = await validateRequest(req, createInventorySchema)
    if (validationError) return validationError

    const costPerServing = data.servingsPerUnit > 0
      ? Math.round((data.costPerUnit / data.servingsPerUnit) * 100) / 100
      : 0

    // FIX HIGH: Wrap inventory item creation + stock transaction in $transaction.
    // If the stock transaction fails, the inventory item would exist with no audit trail.
    const item = await db.$transaction(async (tx) => {
      const created = await tx.inventoryItem.create({
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
          location: data.location, // FIX MEDIUM: Podpora za lokacijo/skladišče
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
      if (isPositive(created.quantity)) {
        await tx.stockTransaction.create({
          data: {
            inventoryItemId: created.id,
            type: 'procurement',
            quantity: toNum(created.quantity),
            previousQty: 0,
            newQty: toNum(created.quantity),
            costPerUnit: created.costPerUnit,
            totalCost: round2(multiply(created.quantity, created.costPerUnit)),
            reason: 'Začetna zaloga',
            employeeName: authResult.session?.employeeId || '',
          },
        })
      }

      return created
    })

    return NextResponse.json(deepToNumbers(item), { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/inventory', 'Napaka pri ustvarjanju zaloge')
  }
}
