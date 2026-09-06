// ============================================
// DIREKTNO RAZKNJIŽEVANJE — Direct 1:1 deduction fallback
// ============================================
//
// FIX P2 (audit 2026-09-06): Atomic preprečitev negative stock.
//
// Prej: `decrement` je zmanjšal količino, nato smo preverili `if (newQty < 0)`
// in popravili na 0. To je pustilo okno za race condition:
//   - Request A prebere qty=5, želi decrement 3 → qty=2
//   - Request B prebere qty=5, želi decrement 4 → qty=1 (ampak bi moral biti -2!)
//   - Rešitev: decrement + clamp v eni UPDATE izjavi z WHERE clause.
//
// Sedaj: `updateMany` z `WHERE quantity >= totalUnitsToDeduct` — če ni dovolj
// zaloge, se update ne zgodi (count=0) in zabeležimo napako namesto da
// tiho dovolimo over-sell.
//
// Če želimo še vedno dovoliti "sell into negative" (forward kompatibilnost),
// lahko uporabimo原子no GREATEST(quantity - N, 0) preko $executeRaw.
// Zaenkrat izberemo strogo varianto: no sale brez dovolj zaloge.
//

import { toNum, round2, multiply, subtract } from '../decimal'
import type { StockDeductionItem, StockDeductionResult } from './types'
import { Prisma } from '@prisma/client'

type TransactionClient = Prisma.TransactionClient

export async function deductDirectItem(
  tx: TransactionClient,
  item: StockDeductionItem,
  orderId: string,
  orderNumber: number,
  result: StockDeductionResult
): Promise<void> {
  const invItem = await tx.inventoryItem.findFirst({
    where: { menuItemId: item.menuItemId },
  })

  if (!invItem || toNum(invItem.servingsPerUnit) <= 0) return

  const unitsPerServing = 1 / toNum(invItem.servingsPerUnit)
  const totalUnitsToDeduct = Math.round(item.quantity * unitsPerServing * 10000) / 10000

  const previousQty = toNum(invItem.quantity)

  // FIX P2: Atomic preprečitev negative stock z updateMany + WHERE clause.
  // Če quantity < totalUnitsToDeduct, se update ne zgodi (count=0).
  // To preprečuje race condition med sočasnimi prodajami.
  const updateResult = await tx.inventoryItem.updateMany({
    where: {
      id: invItem.id,
      quantity: { gte: totalUnitsToDeduct }, // ← atomarni check
    },
    data: {
      quantity: { decrement: totalUnitsToDeduct },
    },
  })

  let actualDeducted = totalUnitsToDeduct
  let newQty: number

  if (updateResult.count === 0) {
    // Ni dovolj zaloge — zabeležimo napako, NE gremo v negativo.
    // Trenutna količina je še vedno `previousQty`.
    actualDeducted = 0
    newQty = previousQty
    result.errors.push({
      inventoryItemId: invItem.id,
      name: invItem.name,
      error: `Premalo zaloge za "${invItem.name}" — na voljo: ${previousQty}, potrebno: ${totalUnitsToDeduct}`,
    })
    result.success = false

    // Še vedno zabeležimo poskus prodaje (za audit)
    await tx.stockTransaction.create({
      data: {
        inventoryItemId: invItem.id,
        type: 'sale',
        quantity: 0, // ni bilo odbito
        previousQty,
        newQty: previousQty,
        costPerUnit: invItem.costPerUnit,
        totalCost: 0,
        reason: `POSKUS PRODAJE (nezadostna zaloga) - naročilo #${orderNumber}`,
        orderId,
      },
    })
  } else {
    // Uspešno odbito — preberemo novo stanje
    const updatedItem = await tx.inventoryItem.findUnique({
      where: { id: invItem.id },
      select: { quantity: true },
    })
    newQty = toNum(updatedItem?.quantity ?? subtract(previousQty, totalUnitsToDeduct))
    actualDeducted = totalUnitsToDeduct

    await tx.stockTransaction.create({
      data: {
        inventoryItemId: invItem.id,
        type: 'sale',
        quantity: -actualDeducted,
        previousQty,
        newQty,
        costPerUnit: invItem.costPerUnit,
        totalCost: round2(multiply(actualDeducted, invItem.costPerUnit)),
        reason: `Prodaja - naročilo #${orderNumber}`,
        orderId,
      },
    })
  }

  result.deducted.push({
    inventoryItemId: invItem.id,
    name: invItem.name,
    quantityDeducted: actualDeducted,
    previousQty,
    newQty,
    method: 'direct',
  })

  if (newQty <= toNum(invItem.minQuantity)) {
    result.lowStockAlerts.push({
      inventoryItemId: invItem.id,
      name: invItem.name,
      currentQty: newQty,
      minQty: toNum(invItem.minQuantity),
    })
  }
}
