import { db } from '@/lib/db'
import { toNum, round2, isPositive, multiply, deepToNumbers } from '@/lib/decimal'

// ============================================
// Inventory API helpers — create inventory item
// ============================================

/** Ustvari nov inventarni artikel s transakcijo v $transaction */
export async function createInventoryItem(
  data: {
    name: string; description?: string; unit: string; quantity: number;
    minQuantity: number; costPerUnit: number; supplier?: string;
    category?: string; location?: string; servingsPerUnit: number;
    servingSize?: string; menuItemId?: string;
  },
  employeeId?: string
) {
  const costPerServing = data.servingsPerUnit > 0
    ? Math.round((data.costPerUnit / data.servingsPerUnit) * 100) / 100
    : 0

  const item = await db.$transaction(async (tx) => {
    const created = await tx.inventoryItem.create({
      data: {
        name: data.name,
        description: data.description,
        image: '',
        unit: data.unit,
        quantity: data.quantity,
        minQuantity: data.minQuantity,
        costPerUnit: data.costPerUnit,
        supplier: data.supplier,
        category: data.category,
        location: data.location,
        expiryDate: null,
        servingsPerUnit: data.servingsPerUnit,
        servingSize: data.servingSize,
        costPerServing,
        menuItemId: data.menuItemId || null,
        lastRestocked: new Date(),
      },
      include: { menuItem: true },
    })

    if (isPositive(created.quantity)) {
      await tx.stockTransaction.create({
        data: {
          inventoryItemId: created.id,
          type: 'procurement',
          quantity: toNum(created.quantity),
          previousQty: 0,
          newQty: toNum(created.quantity),
          costPerUnit: created.costPerUnit,
          totalCost: round2(multiply(created.quantity, created.costPerUnit)),
          reason: 'Začetna zaloga',
          employeeName: employeeId || '',
        },
      })
    }

    return created
  })

  return deepToNumbers(item)
}
