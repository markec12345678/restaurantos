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

    // Pridobi napovedi
    const forecastRes = await fetch(new URL('/api/inventory/forecast', req.url))
    const forecastData = await forecastRes.json()

    if (!forecastData.forecasts) {
      return NextResponse.json({ error: 'Napovedi niso na voljo' }, { status: 500 })
    }

    const suggestions: ReorderSuggestion[] = []

    for (const f of forecastData.forecasts) {
      if (!f.needsReorder && f.riskLevel === 'low') continue
      if (urgency && f.riskLevel !== urgency) continue

      // Pridobi dodaten info o artiklu
      const item = await db.inventoryItem.findUnique({
        where: { id: f.inventoryItemId },
      })

      if (!item) continue

      // Izračunaj povprečen čas dobave iz zgodovine
      const procurements = await db.stockTransaction.findMany({
        where: {
          inventoryItemId: item.id,
          type: 'procurement',
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })

      const avgDeliveryDays = 3 // Privzeto — bi izračunali iz razlike med naročilom in dobavo

      const reason = generateReorderReason(f, item)

      suggestions.push({
        inventoryItemId: f.inventoryItemId,
        itemName: f.itemName,
        unit: f.unit,
        supplier: item.supplier,
        currentStock: f.currentStock,
        suggestedQty: f.suggestedOrderQty,
        costPerUnit: item.costPerUnit,
        totalCost: Math.round(f.suggestedOrderQty * item.costPerUnit * 100) / 100,
        urgency: f.riskLevel as ReorderSuggestion['urgency'],
        reason,
        lastOrderDate: f.lastRestockDate,
        avgDeliveryDays,
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
      // FIX: Ustvari transakcijo IN posodobi zalogo atomarno — prepreči delno stanje
      await db.$transaction(async (tx) => {
        await tx.stockTransaction.create({
          data: {
            inventoryItemId: item.inventoryItemId,
            type: 'procurement',
            quantity: item.quantity,
            previousQty,
            newQty,
            costPerUnit: item.costPerUnit,
            totalCost: item.quantity * item.costPerUnit,
            reason: `Samodejno naročilo (${employeeName || 'sistem'})`,
            employeeName: employeeName || '',
          },
        })

        await tx.inventoryItem.update({
          where: { id: item.inventoryItemId },
          data: {
            quantity: newQty,
            lastRestocked: new Date(),
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
