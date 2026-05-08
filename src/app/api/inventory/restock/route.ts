import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// POST /api/inventory/restock — Vnos nabave (prevzem blaga v zalogo)
export async function POST(req: Request) {
  try {
    const body = await req.json()

    const inventoryItemId = String(body.inventoryItemId || '')
    const qty = Number(body.quantity) || 0
    const unitCostInput = body.costPerUnit !== undefined ? Number(body.costPerUnit) : undefined
    const supplierDoc = String(body.supplierDoc || '')
    const employeeName = String(body.employeeName || '')
    const note = String(body.note || '')

    if (!inventoryItemId || qty <= 0) {
      return NextResponse.json({ error: 'Potreben je ID artikla in pozitivna količina' }, { status: 400 })
    }

    // Pridobi trenutno stanje
    const item = await db.inventoryItem.findUnique({ where: { id: inventoryItemId } })
    if (!item) {
      return NextResponse.json({ error: 'Artikel zaloge ni najden' }, { status: 404 })
    }

    const previousQty = item.quantity
    const newQty = previousQty + qty
    const unitCost = unitCostInput !== undefined ? unitCostInput : item.costPerUnit
    const totalCost = qty * unitCost

    // Posodobi zalogo in ustvari transakcijo v eni transakciji
    const result = await db.$transaction(async (tx) => {
      const updated = await tx.inventoryItem.update({
        where: { id: inventoryItemId },
        data: {
          quantity: newQty,
          costPerUnit: unitCost,
          lastRestocked: new Date(),
          ...(item.servingsPerUnit > 0 ? {
            costPerServing: Math.round((unitCost / item.servingsPerUnit) * 100) / 100,
          } : {}),
        },
        include: { menuItem: true },
      })

      const transaction = await tx.stockTransaction.create({
        data: {
          inventoryItemId,
          type: 'procurement',
          quantity: qty,
          previousQty,
          newQty,
          costPerUnit: unitCost,
          totalCost,
          reason: 'Dobava',
          note,
          supplierDoc,
          employeeName,
        },
      })

      return { updated, transaction }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Restock error:', error)
    return NextResponse.json({ error: 'Napaka pri vnosu nabave' }, { status: 500 })
  }
}
