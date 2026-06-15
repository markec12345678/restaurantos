// Pomožne funkcije za inventory/[id] API — DELETE handler

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { toNum, round2, multiply } from '@/lib/decimal'
import { handleApiError } from '@/lib/api-utils'

// FIX: Soft-delete namesto hard-delete — ohrani transakcijsko zgodovino
export async function handleDeleteInventory(req: Request, id: string) {
  try {
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
