import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, inventoryRestockSchema } from '@/lib/validations'

// POST /api/inventory/restock — Vnos nabave (prevzem blaga v zalogo)
export async function POST(req: Request) {
  try {
    // FIX BUG 10: Zahtevaj avtentikacijo za restock
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX BUG 10: Zod validacija
    const { data, error: validationError } = validateBody(inventoryRestockSchema, body)
    if (validationError) return validationError

    // Pridobi trenutno stanje
    const item = await db.inventoryItem.findUnique({ where: { id: data.inventoryItemId } })
    if (!item) {
      return NextResponse.json({ error: 'Artikel zaloge ni najden' }, { status: 404 })
    }

    const previousQty = item.quantity
    const newQty = Math.round((previousQty + data.quantity) * 10000) / 10000
    const unitCost = item.costPerUnit
    const totalCost = data.quantity * unitCost

    // FIX: Posodobi zalogo in ustvari transakcijo v eni transakciji — atomic increment
    const result = await db.$transaction(async (tx) => {
      // Atomic increment — prepreči race condition z več terminali
      const updated = await tx.inventoryItem.update({
        where: { id: data.inventoryItemId },
        data: {
          quantity: { increment: data.quantity },
          lastRestocked: new Date(),
          ...(item.servingsPerUnit > 0 ? {
            costPerServing: Math.round((unitCost / item.servingsPerUnit) * 100) / 100,
          } : {}),
        },
        include: { menuItem: true },
      })

      const actualNewQty = updated.quantity

      const transaction = await tx.stockTransaction.create({
        data: {
          inventoryItemId: data.inventoryItemId,
          type: 'procurement',
          quantity: data.quantity,
          previousQty: actualNewQty - data.quantity,
          newQty: actualNewQty,
          costPerUnit: unitCost,
          totalCost,
          reason: data.reason,
          note: data.note,
          supplierDoc: data.supplierDoc,
          employeeName: data.employeeName || authResult.session?.employeeId || '',
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
