import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  // Izračunaj costPerServing avtomatsko
  const costPerUnit = body.costPerUnit !== undefined ? parseFloat(body.costPerUnit) : undefined
  const servingsPerUnit = body.servingsPerUnit !== undefined ? parseFloat(body.servingsPerUnit) : undefined

  const updateData: Record<string, unknown> = {}
  if (body.name !== undefined) updateData.name = body.name
  if (body.description !== undefined) updateData.description = body.description
  if (body.image !== undefined) updateData.image = body.image
  if (body.unit !== undefined) updateData.unit = body.unit
  if (body.quantity !== undefined) updateData.quantity = parseFloat(body.quantity)
  if (body.minQuantity !== undefined) updateData.minQuantity = parseFloat(body.minQuantity)
  if (costPerUnit !== undefined) updateData.costPerUnit = costPerUnit
  if (body.supplier !== undefined) updateData.supplier = body.supplier
  if (body.category !== undefined) updateData.category = body.category
  if (body.expiryDate !== undefined) updateData.expiryDate = body.expiryDate ? new Date(body.expiryDate) : null
  if (body.menuItemId !== undefined) updateData.menuItemId = body.menuItemId || null
  if (body.servingSize !== undefined) updateData.servingSize = body.servingSize
  if (servingsPerUnit !== undefined) updateData.servingsPerUnit = servingsPerUnit

  // Avtomatsko posodobi costPerServing
  if (costPerUnit !== undefined || servingsPerUnit !== undefined) {
    const currentItem = await db.inventoryItem.findUnique({ where: { id } })
    if (currentItem) {
      const cpu = costPerUnit !== undefined ? costPerUnit : currentItem.costPerUnit
      const spu = servingsPerUnit !== undefined ? servingsPerUnit : currentItem.servingsPerUnit
      updateData.costPerServing = spu > 0 ? Math.round((cpu / spu) * 100) / 100 : 0
    }
  }

  if (body.quantity !== undefined) updateData.lastRestocked = new Date()

  const item = await db.inventoryItem.update({
    where: { id },
    data: updateData,
    include: { menuItem: true },
  })
  return NextResponse.json(item)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Najprej izbriši povezane transakcije
  await db.stockTransaction.deleteMany({ where: { inventoryItemId: id } })
  await db.inventoryItem.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
