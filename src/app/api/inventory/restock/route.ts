// POST /api/inventory/restock — Vnos nabave (prevzem blaga v zalogo)
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { inventoryRestockSchema } from '@/lib/validations'
import { toNum, round2, multiply, divide, isPositive } from '@/lib/decimal'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    // FIX BUG 10: Zahtevaj avtentikacijo za restock
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    // FIX BUG 10: Zod validacija
    const { data, error: validationError } = validateBody(inventoryRestockSchema, bodyResult.data)
    if (validationError) return validationError
    // Pridobi trenutno stanje
    const item = await db.inventoryItem.findUnique({ where: { id: data.inventoryItemId } })
    if (!item) {
      return NextResponse.json({ error: 'Artikel zaloge ni najden' }, { status: 404 })
    }
    const previousQty = item.quantity
    const _newQty = Math.round((toNum(previousQty) + data.quantity) * 10000) / 10000
    const unitCost = item.costPerUnit
    const totalCost = round2(multiply(data.quantity, unitCost))
    // FIX: Posodobi zalogo in ustvari transakcijo v eni transakciji — atomic increment
    const result = await db.$transaction(async (tx) => {
      // Atomic increment — prepreči race condition z več terminali
      const updated = await tx.inventoryItem.update({
        where: { id: data.inventoryItemId },
        data: {
          quantity: { increment: data.quantity },
          lastRestocked: new Date(),
          ...(isPositive(item.servingsPerUnit) ? {
            costPerServing: round2(divide(unitCost, item.servingsPerUnit)),
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
          previousQty: toNum(actualNewQty) - data.quantity,
          newQty: toNum(actualNewQty),
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
    return NextResponse.json(deepToNumbers(result))
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/inventory/restock', 'Napaka pri vnosu nabave')
  }
}
