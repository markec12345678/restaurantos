
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { updateInventorySchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { toNum, round2, multiply, divide, decEquals, deepToNumbers } from '@/lib/decimal'
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
      // Ne nastavljaj pri zmanjšanju (write-off) — datum zadnje dobave mora ostati pravilen
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
            totalCost: round2(multiply(Math.abs(diff), existing.costPerUnit)),
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

// FIX: Soft-delete namesto hard-delete — ohrani transakcijsko zgodovino
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    const item = await db.inventoryItem.findUnique({
      where: { id },
      include: { transactions: true },
    })

    if (!item) {
      return NextResponse.json({ error: 'Artikel zaloge ni najden' }, { status: 404 })
    }

    // Preveri, če je artikel povezan z menijem
    if (item.menuItemId) {
      const menuItem = await db.menuItem.findUnique({ where: { id: item.menuItemId } })
      if (menuItem && menuItem.isAvailable) {
        return NextResponse.json(
          { error: 'Artikel je povezan z aktivnim menijem — najprej odstranite povezavo ali onemogočite meni artikel.' },
          { status: 400 }
        )
      }
    }

    // FIX MEDIUM: Preveri, če je artikel sestavina v receptih drugih meni artiklov
    const recipeItems = await db.recipeItem.findMany({
      where: { inventoryItemId: id },
      include: { menuItem: { select: { name: true, isAvailable: true } } },
    })
    const activeRecipeItems = recipeItems.filter(ri => ri.menuItem?.isAvailable)
    if (activeRecipeItems.length > 0) {
      const itemNames = activeRecipeItems.map(ri => ri.menuItem?.name || 'Neznan').join(', ')
      return NextResponse.json(
        { error: `Artikel je sestavina v receptih aktivnih artiklov: ${itemNames}. Najprej odstranite iz receptov ali onemogočite te artikle.` },
        { status: 400 }
      )
    }

    // Namesto hard-delete, nastavi količino na 0 in označi kot nedoseno
    // Tako ohranimo transakcijsko zgodovino za FURS/audit
    await db.$transaction(async (tx) => {
      const previousQty = item.quantity
      await tx.inventoryItem.update({
        where: { id },
        data: {
          quantity: 0,
          menuItemId: null, // Odstrani povezavo z menijem
        },
      })
      await tx.stockTransaction.create({
        data: {
          inventoryItemId: id,
          type: 'write-off',
          quantity: -toNum(previousQty),
          previousQty: toNum(previousQty),
          newQty: 0,
          costPerUnit: item.costPerUnit,
          totalCost: round2(multiply(previousQty, item.costPerUnit)),
          reason: 'Izbris artikla iz zaloge',
          note: 'Artikel odstranjen iz sistema',
          employeeName: authResult.session?.employeeId || '',
        },
      })
    })

    return NextResponse.json({ success: true, message: 'Artikel označen kot izbrisan, transakcijska zgodovina ohranjena' })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/inventory/[id]', 'Napaka pri brisanju zaloge')
  }
}
