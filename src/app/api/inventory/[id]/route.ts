
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { updateInventorySchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { toNum, round2, divide, decEquals, deepToNumbers } from '@/lib/decimal'
import { handleDeleteInventory } from './_helpers'


export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(updateInventorySchema, bodyResult.data)
    if (validationError) return validationError

    const existing = await db.inventoryItem.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Artikel zaloge ni najden' }, { status: 404 })
    }

    const costPerUnit = data.costPerUnit !== undefined ? data.costPerUnit : existing.costPerUnit
    const servingsPerUnit = data.servingsPerUnit !== undefined ? data.servingsPerUnit : existing.servingsPerUnit

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.image !== undefined) updateData.image = data.image
    if (data.unit !== undefined) updateData.unit = data.unit
    if (data.minQuantity !== undefined) updateData.minQuantity = data.minQuantity
    if (data.supplier !== undefined) updateData.supplier = data.supplier
    if (data.category !== undefined) updateData.category = data.category
    if (data.location !== undefined) updateData.location = data.location // FIX MEDIUM: Podpora za lokacijo
    if (data.expiryDate !== undefined) updateData.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null
    if (data.menuItemId !== undefined) updateData.menuItemId = data.menuItemId || null
    if (data.servingSize !== undefined) updateData.servingSize = data.servingSize
    if (data.servingsPerUnit !== undefined) updateData.servingsPerUnit = data.servingsPerUnit
    if (data.costPerUnit !== undefined) updateData.costPerUnit = data.costPerUnit

    // Avtomatsko posodobi costPerServing
    if (data.costPerUnit !== undefined || data.servingsPerUnit !== undefined) {
      updateData.costPerServing = toNum(servingsPerUnit) > 0 ? round2(divide(costPerUnit, servingsPerUnit)) : 0
    }

    // FIX: Če se količina spreminja, ustvari transakcijski zapis
    if (data.quantity !== undefined && !decEquals(data.quantity, existing.quantity)) {
      const newQty = data.quantity
      const previousQty = existing.quantity
      const diff = newQty - toNum(previousQty)

      updateData.quantity = newQty
      // FIX MEDIUM: lastRestocked nastavi SAMO ko se količina poveča (dostava/restock)
      if (diff > 0) {
        updateData.lastRestocked = new Date()
      }

      // Atomna transakcija: posodobi količino + zabeleži transakcijo
      const result = await db.$transaction(async (tx) => {
        const updated = await tx.inventoryItem.update({
          where: { id },
          data: updateData,
          include: { menuItem: true },
        })

        await tx.stockTransaction.create({
          data: {
            inventoryItemId: id,
            type: diff > 0 ? 'adjustment' : 'write-off',
            quantity: diff,
            previousQty: toNum(previousQty),
            newQty,
            costPerUnit: existing.costPerUnit,
            totalCost: round2(toNum(existing.costPerUnit) * diff),
            reason: diff > 0 ? 'Ročna prilagoditev zaloge' : 'Ročna razknjižba zaloge',
            note: 'Posodobitev preko API',
            employeeName: authResult.session?.employeeId || '',
          },
        })

        return updated
      })

      return NextResponse.json(deepToNumbers(result))
    }

    const item = await db.inventoryItem.update({
      where: { id },
      data: updateData,
      include: { menuItem: true },
    })
    return NextResponse.json(deepToNumbers(item))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/inventory/[id]', 'Napaka pri posodobitvi zaloge')
  }
}

// FIX: PATCH method — delna posodobitev (npr. samo minQuantity ali quantity)
// Prej samo PUT, ki zahteva vse polja. PATCH omogoča posodobitev posameznih polj.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const { data, error: validationError } = validateBody(updateInventorySchema, bodyResult.data)
    if (validationError) return validationError

    const existing = await db.inventoryItem.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Artikel zaloge ni najden' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.image !== undefined) updateData.image = data.image
    if (data.unit !== undefined) updateData.unit = data.unit
    if (data.minQuantity !== undefined) updateData.minQuantity = data.minQuantity
    if (data.supplier !== undefined) updateData.supplier = data.supplier
    if (data.category !== undefined) updateData.category = data.category
    if (data.location !== undefined) updateData.location = data.location
    if (data.expiryDate !== undefined) updateData.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null
    if (data.menuItemId !== undefined) updateData.menuItemId = data.menuItemId || null
    if (data.servingSize !== undefined) updateData.servingSize = data.servingSize
    if (data.servingsPerUnit !== undefined) updateData.servingsPerUnit = data.servingsPerUnit
    if (data.costPerUnit !== undefined) updateData.costPerUnit = data.costPerUnit

    // Avtomatsko posodobi costPerServing
    const costPerUnit = data.costPerUnit !== undefined ? data.costPerUnit : existing.costPerUnit
    const servingsPerUnit = data.servingsPerUnit !== undefined ? data.servingsPerUnit : existing.servingsPerUnit
    if (data.costPerUnit !== undefined || data.servingsPerUnit !== undefined) {
      updateData.costPerServing = toNum(servingsPerUnit) > 0 ? round2(divide(costPerUnit, servingsPerUnit)) : 0
    }

    // Če se količina spreminja, ustvari StockTransaction
    if (data.quantity !== undefined && !decEquals(data.quantity, existing.quantity)) {
      const newQty = data.quantity
      const previousQty = existing.quantity
      const diff = newQty - toNum(previousQty)
      updateData.quantity = newQty
      if (diff > 0) updateData.lastRestocked = new Date()

      const result = await db.$transaction(async (tx) => {
        const updated = await tx.inventoryItem.update({
          where: { id },
          data: updateData,
          include: { menuItem: true },
        })
        await tx.stockTransaction.create({
          data: {
            inventoryItemId: id,
            type: diff > 0 ? 'adjustment' : 'write-off',
            quantity: diff,
            previousQty: toNum(previousQty),
            newQty,
            costPerUnit: existing.costPerUnit,
            totalCost: round2(toNum(existing.costPerUnit) * diff),
            reason: diff > 0 ? 'Ročna prilagoditev (PATCH)' : 'Ročna razknjižba (PATCH)',
            employeeName: authResult.session?.employeeId || '',
          },
        })
        return updated
      })
      return NextResponse.json(deepToNumbers(result))
    }

    const item = await db.inventoryItem.update({
      where: { id },
      data: updateData,
      include: { menuItem: true },
    })
    return NextResponse.json(deepToNumbers(item))
  } catch (error: unknown) {
    return handleApiError(error, 'PATCH /api/inventory/[id]', 'Napaka pri delni posodobitvi zaloge')
  }
}

// FIX: Soft-delete namesto hard-delete — ohrani transakcijsko zgodovino
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return handleDeleteInventory(req, id)
}
