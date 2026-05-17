import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, updateInventorySchema } from '@/lib/validations'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(updateInventorySchema, body)
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
      updateData.costPerServing = servingsPerUnit > 0 ? Math.round((costPerUnit / servingsPerUnit) * 100) / 100 : 0
    }

    // FIX: Če se količina spreminja, ustvari transakcijski zapis
    if (data.quantity !== undefined && data.quantity !== existing.quantity) {
      const newQty = data.quantity
      const previousQty = existing.quantity
      const diff = newQty - previousQty

      updateData.quantity = newQty
      updateData.lastRestocked = new Date()

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
            previousQty,
            newQty,
            costPerUnit: existing.costPerUnit,
            totalCost: Math.abs(diff) * existing.costPerUnit,
            reason: diff > 0 ? 'Ročna prilagoditev zaloge' : 'Ročna razknjižba zaloge',
            note: 'Posodobitev preko API',
            employeeName: authResult.session?.employeeId || '',
          },
        })

        return updated
      })

      return NextResponse.json(result)
    }

    const item = await db.inventoryItem.update({
      where: { id },
      data: updateData,
      include: { menuItem: true },
    })
    return NextResponse.json(item)
  } catch (error) {
    console.error('Napaka pri posodobitvi zaloge:', error)
    return NextResponse.json({ error: 'Napaka pri posodobitvi zaloge' }, { status: 500 })
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
          quantity: -previousQty,
          previousQty,
          newQty: 0,
          costPerUnit: item.costPerUnit,
          totalCost: previousQty * item.costPerUnit,
          reason: 'Izbris artikla iz zaloge',
          note: 'Artikel odstranjen iz sistema',
          employeeName: authResult.session?.employeeId || '',
        },
      })
    })

    return NextResponse.json({ success: true, message: 'Artikel označen kot izbrisan, transakcijska zgodovina ohranjena' })
  } catch (error) {
    console.error('Napaka pri brisanju zaloge:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju zaloge' }, { status: 500 })
  }
}
