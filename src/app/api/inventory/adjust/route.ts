// POST /api/inventory/adjust — Razknjižba/Odpis zaloge
import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { inventoryAdjustSchema, batchAdjustSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { toNum, round2, multiply } from '@/lib/decimal'
export async function POST(req: Request) {
  try {
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error
    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(inventoryAdjustSchema, bodyResult.data)
    if (validationError) return validationError
    const item = await db.inventoryItem.findUnique({ where: { id: data.inventoryItemId } })
    if (!item) {
      return NextResponse.json({ error: 'Artikel zaloge ni najden' }, { status: 404 })
    }
    const previousQty = item.quantity
    let newQty: number
    let txQuantity: number
    if (data.type === 'adjustment' && data.newQuantity !== undefined) {
      newQty = Math.max(0, data.newQuantity)
      txQuantity = newQty - toNum(previousQty)
    } else {
      if (!data.quantity || data.quantity <= 0) {
        return NextResponse.json({ error: 'Količina mora biti pozitivna' }, { status: 400 })
      }
      // FIX MEDIUM: Opozori, če odpis presega razpoložljivo zalogo — ne odpisi več kot je na zalogi
      if (data.quantity > toNum(previousQty)) {
        return NextResponse.json(
          { error: `Odpis (${data.quantity}) presega razpoložljivo zalogo (${toNum(previousQty)})` },
          { status: 400 }
        )
      }
      newQty = Math.max(0, toNum(previousQty) - data.quantity)
      txQuantity = -data.quantity
    }
    const totalCost = round2(multiply(Math.abs(txQuantity), item.costPerUnit))
    // FIX HIGH: Re-read quantity INSIDE transaction to prevent stale read race condition
    const result = await db.$transaction(async (tx) => {
      const currentItem = await tx.inventoryItem.findUnique({ where: { id: data.inventoryItemId } })
      if (!currentItem) {
        throw new Error('Artikel ni najden')
      }
      const currentQty = currentItem.quantity
      const delta = data.type === 'adjustment' && data.newQuantity !== undefined
        ? Math.max(0, data.newQuantity) - toNum(currentQty)
        : -Math.min(data.quantity || 0, toNum(currentQty)) // FIX: Cap deduction at current quantity
      const updated = await tx.inventoryItem.update({
        where: { id: data.inventoryItemId },
        data: delta >= 0
          ? { quantity: { increment: delta } }
          : { quantity: { decrement: Math.abs(delta) } },
        include: { menuItem: true },
      })
      const transaction = await tx.stockTransaction.create({
        data: {
          inventoryItemId: data.inventoryItemId,
          type: data.type,
          quantity: txQuantity,
          previousQty: toNum(currentQty),
          newQty: toNum(currentQty) + delta,
          costPerUnit: item.costPerUnit,
          totalCost,
          reason: data.reason,
          note: data.note,
          supplierDoc: data.supplierDoc,
          employeeName: data.employeeName || authResult.session?.employeeId || '',
        },
      })
      return { updated, transaction }
    })
    // FIX MEDIUM: Audit log za razknjižbo zaloge
    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'INVENTORY_ADJUST',
      entityType: 'InventoryItem',
      entityId: data.inventoryItemId,
      details: { type: data.type, quantity: txQuantity, previousQty: toNum(previousQty), newQty, reason: data.reason, itemName: item.name },
    })
    return NextResponse.json(result)
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/inventory/adjust', 'Napaka pri razknjižbi')
  }
}
// PUT — batch razknjižba (V ENI TRANSAKCIJI)
export async function PUT(req: Request) {
  try {
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error
    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(batchAdjustSchema, bodyResult.data)
    if (validationError) return validationError
    // FIX: Batch operacije v ENI transakciji
    const results = await db.$transaction(async (tx) => {
      const processed: { updated: Record<string, unknown>; transaction: Record<string, unknown> }[] = []
      const skipped: { inventoryItemId: string; reason: string }[] = []
      for (const entry of data.items) {
        const item = await tx.inventoryItem.findUnique({ where: { id: entry.inventoryItemId } })
        if (!item) {
          // FIX MEDIUM: Namesto tihega preskoka — zabeleži kateri artikli manjkajo
          skipped.push({ inventoryItemId: entry.inventoryItemId, reason: 'Artikel ni najden' })
          continue
        }
        const previousQty = item.quantity
        const deductQty = entry.quantity
        if (deductQty <= 0) {
          skipped.push({ inventoryItemId: entry.inventoryItemId, reason: 'Količina mora biti pozitivna' })
          continue
        }
        const _newQty = Math.max(0, toNum(previousQty) - deductQty)
        const txQuantity = -deductQty
        const totalCost = round2(multiply(deductQty, item.costPerUnit))
        // FIX CRITICAL: Use atomic decrement instead of direct set — prevents race condition
        const updated = await tx.inventoryItem.update({
          where: { id: entry.inventoryItemId },
          data: { quantity: { decrement: deductQty } },
          include: { menuItem: true },
        })
        // Clamp to 0 if quantity went negative
        const actualNewQty = Math.max(0, toNum(updated.quantity))
        if (toNum(updated.quantity) < 0) {
          await tx.inventoryItem.update({
            where: { id: entry.inventoryItemId },
            data: { quantity: 0 },
          })
        }
        const transaction = await tx.stockTransaction.create({
          data: {
            inventoryItemId: entry.inventoryItemId,
            type: data.type,
            quantity: txQuantity,
            previousQty: toNum(previousQty),
            newQty: actualNewQty,
            costPerUnit: item.costPerUnit,
            totalCost,
            reason: data.reason || entry.reason || '',
            note: entry.note || '',
            employeeName: data.employeeName || authResult.session?.employeeId || '',
          },
        })
        processed.push({ updated, transaction })
      }
      return { processed, skipped }
    })
    return NextResponse.json({ processed: results.processed.length, results: results.processed, skipped: results.skipped })
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/inventory/adjust', 'Napaka pri batch razknjižbi')
  }
}
