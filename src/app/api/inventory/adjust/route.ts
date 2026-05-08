import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// POST /api/inventory/adjust — Razknjižba/Odpis zaloge
export async function POST(req: Request) {
  try {
    const body = await req.json()

    const inventoryItemId = String(body.inventoryItemId || '')
    const quantity = Number(body.quantity) || 0
    const adjustmentType = String(body.type || 'write-off')
    const reason = String(body.reason || '')
    const note = String(body.note || '')
    const employeeName = String(body.employeeName || '')
    const supplierDoc = String(body.supplierDoc || '')
    const newQuantity = body.newQuantity !== undefined ? Number(body.newQuantity) : undefined

    if (!inventoryItemId) {
      return NextResponse.json({ error: 'Potreben je ID artikla' }, { status: 400 })
    }

    // Pridobi trenutno stanje
    const item = await db.inventoryItem.findUnique({ where: { id: inventoryItemId } })
    if (!item) {
      return NextResponse.json({ error: 'Artikel zaloge ni najden' }, { status: 404 })
    }

    const previousQty = item.quantity
    let newQty: number
    let txQuantity: number

    if (adjustmentType === 'adjustment' && newQuantity !== undefined) {
      newQty = newQuantity
      txQuantity = newQty - previousQty
    } else {
      if (quantity <= 0) {
        return NextResponse.json({ error: 'Količina mora biti pozitivna' }, { status: 400 })
      }
      newQty = Math.max(0, previousQty - quantity)
      txQuantity = -quantity
    }

    const totalCost = Math.abs(txQuantity) * item.costPerUnit

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.inventoryItem.update({
        where: { id: inventoryItemId },
        data: { quantity: newQty },
        include: { menuItem: true },
      })

      const transaction = await tx.stockTransaction.create({
        data: {
          inventoryItemId,
          type: adjustmentType,
          quantity: txQuantity,
          previousQty,
          newQty,
          costPerUnit: item.costPerUnit,
          totalCost,
          reason,
          note,
          supplierDoc,
          employeeName,
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

// PUT — batch razknjižba
export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const { items, type, reason, employeeName } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Potreben je seznam artiklov' }, { status: 400 })
    }

    const results = []

    for (const entry of items) {
      const item = await db.inventoryItem.findUnique({ where: { id: entry.inventoryItemId } })
      if (!item) continue

      const previousQty = item.quantity
      const deductQty = Number(entry.quantity) || 0
      if (deductQty <= 0) continue

      const newQty = Math.max(0, previousQty - deductQty)
      const txQuantity = -deductQty
      const totalCost = deductQty * item.costPerUnit

      const result = await db.$transaction(async (tx) => {
        const updated = await tx.inventoryItem.update({
          where: { id: entry.inventoryItemId },
          data: { quantity: newQty },
          include: { menuItem: true },
        })

        const transaction = await tx.stockTransaction.create({
          data: {
            inventoryItemId: entry.inventoryItemId,
            type: type || 'write-off',
            quantity: txQuantity,
            previousQty,
            newQty,
            costPerUnit: item.costPerUnit,
            totalCost,
            reason: reason || entry.reason || '',
            note: entry.note || '',
            employeeName: employeeName || '',
          },
        })

        return { updated, transaction }
      })

      results.push(result)
    }

    return NextResponse.json({ processed: results.length, results })
  } catch (error) {
    console.error('Batch adjust error:', error)
    return NextResponse.json({ error: 'Napaka pri batch razknjižbi' }, { status: 500 })
  }
}
