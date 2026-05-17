// ============================================
// PAMETNO NAROČANJE ZALOGE (Smart Reorder)
// Samodejno predlaga naročila glede na napovedi,
// dobavitelje in zgodovino dobav
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, createReorderSchema } from '@/lib/validations'

interface ReorderSuggestion {
  inventoryItemId: string
  itemName: string
  unit: string
  supplier: string
  currentStock: number
  suggestedQty: number
  costPerUnit: number
  totalCost: number
  urgency: 'critical' | 'high' | 'medium' | 'low'
  reason: string
  lastOrderDate: string | null
  avgDeliveryDays: number
  category: string
}

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const urgency = searchParams.get('urgency') || '' // filter by urgency

    // FIX CRITICAL: Pridobi napovedi DIREKTNO iz baze namesto internal fetch-ja
    // Internal fetch bi potreboval auth token, ki ga ni — uporabimo direktno poizvedbo

    // Pridobi vse artikle za analizo
    const allItems = await db.inventoryItem.findMany({
      orderBy: { quantity: 'asc' },
    })

    // Pridobi zadnje transakcije za izračun povprečne porabe
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const suggestions: ReorderSuggestion[] = []

    // FIX MEDIUM: Batch query namesto N+1 — pridobi vse transakcije naenkrat
    const allItemIds = allItems.map(item => item.id)

    const [allSales, allProcurements] = await Promise.all([
      db.stockTransaction.findMany({
        where: {
          inventoryItemId: { in: allItemIds },
          type: 'sale',
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      db.stockTransaction.findMany({
        where: {
          inventoryItemId: { in: allItemIds },
          type: 'procurement',
        },
        orderBy: { createdAt: 'desc' },
        distinct: ['inventoryItemId'],
        select: { inventoryItemId: true, createdAt: true },
      }),
    ])

    // Zgradi lookup mapi
    const salesByItem = new Map<string, typeof allSales>()
    for (const tx of allSales) {
      if (!salesByItem.has(tx.inventoryItemId)) salesByItem.set(tx.inventoryItemId, [])
      salesByItem.get(tx.inventoryItemId)!.push(tx)
    }
    const lastProcByItem = new Map(allProcurements.map(p => [p.inventoryItemId, p]))

    for (const item of allItems) {
      // Izračunaj porabo zadnjih 7 in 30 dni
      const recentSales = salesByItem.get(item.id) || []

      const last7DaysSales = recentSales.filter(t => new Date(t.createdAt) >= sevenDaysAgo)
      const totalSold7d = last7DaysSales.reduce((s, t) => s + Math.abs(t.quantity), 0)
      const totalSold30d = recentSales.reduce((s, t) => s + Math.abs(t.quantity), 0)

      const avgDailyConsumption = totalSold30d > 0 ? totalSold30d / 30 : 0
      const recentDailyConsumption = totalSold7d > 0 ? totalSold7d / 7 : 0

      // Trend: ali poraba narašča?
      const trend = recentDailyConsumption > avgDailyConsumption * 1.2 ? 'increasing' :
                    recentDailyConsumption < avgDailyConsumption * 0.5 ? 'decreasing' : 'stable'

      const isLowStock = item.quantity <= item.minQuantity
      const daysUntilEmpty = avgDailyConsumption > 0 ? Math.floor(item.quantity / avgDailyConsumption) : 999

      // Določi nujnost
      let riskLevel: 'critical' | 'high' | 'medium' | 'low' = 'low'
      if (item.quantity <= 0 || daysUntilEmpty <= 1) riskLevel = 'critical'
      else if (isLowStock || daysUntilEmpty <= 3) riskLevel = 'high'
      else if (daysUntilEmpty <= 7 || trend === 'increasing') riskLevel = 'medium'

      const needsReorder = isLowStock || daysUntilEmpty <= 7 || riskLevel !== 'low'

      if (!needsReorder && riskLevel === 'low') continue
      if (urgency && riskLevel !== urgency) continue

      // Predlagana količina: pokrij 14 dni porabe ali dopolni do 2x minimalne zaloge
      const suggestedOrderQty = Math.max(
        Math.ceil(avgDailyConsumption * 14),
        Math.max(item.minQuantity * 2 - item.quantity, 0),
        1
      )

      const reason = generateReorderReason({
        daysUntilEmpty,
        currentStock: item.quantity,
        minStock: item.minQuantity,
        trend,
        seasonalityFactor: 1,
        riskLevel,
        needsReorder,
      }, item)

      // Pridobi zadnji datum dobave (iz batch lookup mape)
      const lastProcurement = lastProcByItem.get(item.id)

      suggestions.push({
        inventoryItemId: item.id,
        itemName: item.name,
        unit: item.unit,
        supplier: item.supplier,
        currentStock: item.quantity,
        suggestedQty: suggestedOrderQty,
        costPerUnit: item.costPerUnit,
        totalCost: Math.round(suggestedOrderQty * item.costPerUnit * 100) / 100,
        urgency: riskLevel as ReorderSuggestion['urgency'],
        reason,
        lastOrderDate: lastProcurement?.createdAt?.toISOString() || null,
        avgDeliveryDays: 3,
        category: item.category,
      })
    }

    // Razvrsti po nujnosti
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    suggestions.sort((a, b) => (urgencyOrder[a.urgency] || 3) - (urgencyOrder[b.urgency] || 3))

    // Povzetek
    const summary = {
      totalSuggestions: suggestions.length,
      totalEstimatedCost: Math.round(suggestions.reduce((s, r) => s + r.totalCost, 0) * 100) / 100,
      criticalCount: suggestions.filter(s => s.urgency === 'critical').length,
      highCount: suggestions.filter(s => s.urgency === 'high').length,
      bySupplier: groupBy(suggestions, 'supplier'),
      byCategory: groupBy(suggestions, 'category'),
    }

    return NextResponse.json({ summary, suggestions })
  } catch (error) {
    console.error('Napaka pri predlaganju naročil:', error)
    return NextResponse.json({ error: 'Napaka pri predlaganju naročil' }, { status: 500 })
  }
}

/**
 * Ustvari naročilnico iz predlogov
 */
export async function POST(req: Request) {
  try {
    // FIX HIGH: Zahtevaj manage_inventory dovoljenje za naročanje zaloge
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX CRITICAL: Zod validacija za naročilo zaloge
    const { data, error: validationError } = validateBody(createReorderSchema, body)
    if (validationError) return validationError

    const { items, employeeName } = data

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Ni artiklov za naročilo' }, { status: 400 })
    }

    const results: Array<{ inventoryItemId: string; itemName: string; quantity: number; totalCost: number }> = []

    // FIX MEDIUM: Batch query namesto N+1 — pridobi vse artikle naenkrat
    const itemIds = items.map(item => item.inventoryItemId)
    const invItems = await db.inventoryItem.findMany({
      where: { id: { in: itemIds } },
    })
    const invItemMap = new Map(invItems.map(i => [i.id, i]))

    for (const item of items) {
      const invItem = invItemMap.get(item.inventoryItemId)
      if (!invItem) continue

      const previousQty = invItem.quantity
      const newQty = Math.round((previousQty + item.quantity) * 10000) / 10000

      // Ustvari transakcijo tipa "procurement" (naročilo dobavitelja)
      // FIX: Ustvari transakcijo IN posodobi zalogo atomarno — uporabi atomic increment
      await db.$transaction(async (tx) => {
        // FIX MEDIUM: Atomic increment — prepreči race condition
        const updated = await tx.inventoryItem.update({
          where: { id: item.inventoryItemId },
          data: {
            quantity: { increment: item.quantity },
            lastRestocked: new Date(),
          },
        })

        await tx.stockTransaction.create({
          data: {
            inventoryItemId: item.inventoryItemId,
            type: 'procurement',
            quantity: item.quantity,
            previousQty: updated.quantity - item.quantity,
            newQty: updated.quantity,
            costPerUnit: item.costPerUnit,
            totalCost: item.quantity * item.costPerUnit,
            reason: `Samodejno naročilo (${employeeName || 'sistem'})`,
            employeeName: employeeName || '',
          },
        })
      })

      results.push({
        inventoryItemId: item.inventoryItemId,
        itemName: invItem.name,
        quantity: item.quantity,
        totalCost: item.quantity * item.costPerUnit,
      })
    }

    return NextResponse.json({
      success: true,
      createdOrders: results.length,
      totalCost: Math.round(results.reduce((s, r) => s + r.totalCost, 0) * 100) / 100,
      items: results,
    }, { status: 201 })
  } catch (error) {
    console.error('Napaka pri ustvarjanju naročila:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju naročila' }, { status: 500 })
  }
}

// ============================================
// HELPERJI
// ============================================

function generateReorderReason(
  f: Record<string, unknown>,
  item: Record<string, unknown>
): string {
  const reasons: string[] = []

  if (f.daysUntilEmpty !== null && (f.daysUntilEmpty as number) <= 2) {
    reasons.push(`Zaloga zmanjka čez ${f.daysUntilEmpty} dni!`)
  } else if (f.daysUntilEmpty !== null && (f.daysUntilEmpty as number) <= 7) {
    reasons.push(`Zaloga zmanjka čez ${f.daysUntilEmpty} dni`)
  }

  if (Number(f.currentStock) <= Number(f.minStock)) {
    reasons.push('Pod minimalno zalogo')
  }

  if (f.trend === 'increasing') {
    reasons.push('Poraba narašča')
  }

  if ((f.seasonalityFactor as number) > 1.2) {
    reasons.push('Vikend porast pričakovana')
  }

  if (reasons.length === 0) {
    reasons.push('Priporočeno naročilo glede na napoved')
  }

  return reasons.join(' · ')
}

function groupBy(arr: ReorderSuggestion[], key: keyof ReorderSuggestion): Record<string, number> {
  const grouped: Record<string, number> = {}
  for (const item of arr) {
    const k = String(item[key] || 'Neznano')
    grouped[k] = (grouped[k] || 0) + 1
  }
  return grouped
}
