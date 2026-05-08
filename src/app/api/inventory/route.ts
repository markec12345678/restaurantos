import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')

  const where: Record<string, unknown> = {}
  if (category) where.category = category

  const items = await db.inventoryItem.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { menuItem: true },
  })
  return NextResponse.json(items)
}

export async function POST(req: Request) {
  const body = await req.json()
  const item = await db.inventoryItem.create({
    data: {
      name: body.name,
      unit: body.unit || 'pcs',
      quantity: body.quantity || 0,
      minQuantity: body.minQuantity || 10,
      costPerUnit: body.costPerUnit || 0,
      supplier: body.supplier || '',
      category: body.category || 'general',
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      menuItemId: body.menuItemId || null,
      lastRestocked: new Date(),
    },
    include: { menuItem: true },
  })
  return NextResponse.json(item)
}
