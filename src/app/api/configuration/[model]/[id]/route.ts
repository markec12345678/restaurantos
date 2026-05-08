import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

const modelMap: Record<string, keyof typeof db> = {
  'tax-rates': 'taxRate',
  'dining-options': 'diningOption',
  'revenue-centers': 'revenueCenter',
  'sales-categories': 'salesCategory',
  'price-groups': 'priceGroup',
  'service-charges': 'serviceCharge',
  'prep-stations': 'prepStation',
  'void-reasons': 'voidReason',
  'no-sale-reasons': 'noSaleReason',
  'alternate-payment-types': 'alternatePaymentType',
  printers: 'printer',
  discounts: 'discount',
}

const includeMap: Record<string, Record<string, boolean>> = {
  'dining-options': { serviceCharge: true },
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ model: string; id: string }> }
) {
  try {
    const { model, id } = await params
    const prismaModel = modelMap[model]
    if (!prismaModel) {
      return NextResponse.json({ error: `Unknown model: ${model}` }, { status: 400 })
    }

    const data = await req.json()

    const item = await (db as any)[prismaModel].update({
      where: { id },
      data,
      include: includeMap[model] || undefined,
    })

    return NextResponse.json(item)
  } catch (error) {
    console.error('Failed to update configuration item:', error)
    return NextResponse.json({ error: 'Failed to update configuration item' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ model: string; id: string }> }
) {
  try {
    const { model, id } = await params
    const prismaModel = modelMap[model]
    if (!prismaModel) {
      return NextResponse.json({ error: `Unknown model: ${model}` }, { status: 400 })
    }

    await (db as any)[prismaModel].delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete configuration item:', error)
    return NextResponse.json({ error: 'Failed to delete configuration item' }, { status: 500 })
  }
}
