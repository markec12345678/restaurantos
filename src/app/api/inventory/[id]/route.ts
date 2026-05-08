import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const item = await db.inventoryItem.update({
    where: { id },
    data: {
      name: body.name,
      unit: body.unit,
      quantity: body.quantity,
      minQuantity: body.minQuantity,
      costPerUnit: body.costPerUnit,
      supplier: body.supplier,
      category: body.category,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      menuItemId: body.menuItemId,
      lastRestocked: body.quantity !== undefined ? new Date() : undefined,
    },
    include: { menuItem: true },
  })
  return NextResponse.json(item)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.inventoryItem.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
