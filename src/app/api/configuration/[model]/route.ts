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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ model: string }> }
) {
  try {
    const { model } = await params
    const prismaModel = modelMap[model]
    if (!prismaModel) {
      return NextResponse.json({ error: `Unknown model: ${model}` }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const isActive = searchParams.get('isActive')

    const where: Record<string, unknown> = {}
    if (isActive !== null) where.isActive = isActive === 'true'

    const items = await (db as any)[prismaModel].findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: includeMap[model] || undefined,
    })

    return NextResponse.json(items)
  } catch (error) {
    console.error('Failed to fetch configuration items:', error)
    return NextResponse.json({ error: 'Failed to fetch configuration items' }, { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ model: string }> }
) {
  try {
    const { model } = await params
    const prismaModel = modelMap[model]
    if (!prismaModel) {
      return NextResponse.json({ error: `Unknown model: ${model}` }, { status: 400 })
    }

    const data = await req.json()

    const item = await (db as any)[prismaModel].create({
      data,
      include: includeMap[model] || undefined,
    })

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('Failed to create configuration item:', error)
    return NextResponse.json({ error: 'Failed to create configuration item' }, { status: 500 })
  }
}
