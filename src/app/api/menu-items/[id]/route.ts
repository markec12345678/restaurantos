import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const item = await db.menuItem.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description,
      price: body.price,
      image: body.image,
      isAvailable: body.isAvailable,
      sortOrder: body.sortOrder,
      categoryId: body.categoryId,
    },
    include: { category: true },
  })
  return NextResponse.json(item)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.menuItem.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
