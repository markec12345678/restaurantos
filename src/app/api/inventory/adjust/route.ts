import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, inventoryAdjustSchema, batchAdjustSchema } from '@/lib/validations'

// POST /api/inventory/adjust — Razknjižba/Odpis zaloge
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(inventoryAdjustSchema, body)
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
      txQuantity = newQty - previousQty
    } else {
      if (!data.quantity || data.quantity <= 0) {
        return NextResponse.json({ error: 'Količina mora biti pozitivna' }, { status: 400 })
      }
      newQty = Math.max(0, previousQty - data.quantity)
      txQuantity = -data.quantity
    }

    const totalCost = Math.abs(txQuantity) * item.costPerUnit

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.inventoryItem.update({
        where: { id: data.inventoryItemId },
        data: { quantity: newQty },
        include: { menuItem: true },
      })

      const transaction = await tx.stockTransaction.create({
        data: {
          inventoryItemId: data.inventoryItemId,
          type: data.type,
          quantity: txQuantity,
          previousQty,
          newQty,
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

    return NextResponse.json(result)
  } catch (error) {
    console.error('Adjust error:', error)
    return NextResponse.json({ error: 'Napaka pri razknjižbi' }, { status: 500 })
  }
}

// PUT — batch razknjižba (V ENI TRANSAKCIJI)
export async function PUT(req: Request) {
  try {
    const body = await req.json()

    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_inventory' })
    if (authResult.error) return authResult.error

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(batchAdjustSchema, body)
    if (validationError) return validationError

    // FIX: Batch operacije v ENI transakciji
    const results = await db.$transaction(async (tx) => {
      const processed = []

      for (const entry of data.items) {
        const item = await tx.inventoryItem.findUnique({ where: { id: entry.inventoryItemId } })
        if (!item) continue

        const previousQty = item.quantity
        const deductQty = entry.quantity
        if (deductQty <= 0) continue

        const newQty = Math.max(0, previousQty - deductQty)
        const txQuantity = -deductQty
        const totalCost = deductQty * item.costPerUnit

        const updated = await tx.inventoryItem.update({
          where: { id: entry.inventoryItemId },
          data: { quantity: newQty },
          include: { menuItem: true },
        })

        const transaction = await tx.stockTransaction.create({
          data: {
            inventoryItemId: entry.inventoryItemId,
            type: data.type,
            quantity: txQuantity,
            previousQty,
            newQty,
            costPerUnit: item.costPerUnit,
            totalCost,
            reason: data.reason || entry.reason || '',
            note: entry.note || '',
            employeeName: data.employeeName || authResult.session?.employeeId || '',
          },
        })

        processed.push({ updated, transaction })
      }

      return processed
    })

    return NextResponse.json({ processed: results.length, results })
  } catch (error) {
    console.error('Batch adjust error:', error)
    return NextResponse.json({ error: 'Napaka pri batch razknjižbi' }, { status: 500 })
  }
}
