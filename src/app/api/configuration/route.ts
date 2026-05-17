import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const [
      taxRates,
      diningOptions,
      revenueCenters,
      salesCategories,
      priceGroups,
      serviceCharges,
      prepStations,
      voidReasons,
      noSaleReasons,
      alternatePaymentTypes,
      printers,
      discounts,
    ] = await Promise.all([
      db.taxRate.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.diningOption.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { serviceCharge: true },
      }),
      db.revenueCenter.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.salesCategory.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.priceGroup.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.serviceCharge.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.prepStation.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.voidReason.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.noSaleReason.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.alternatePaymentType.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.printer.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.discount.findMany({ orderBy: { sortOrder: 'asc' } }),
    ])

    return NextResponse.json({
      taxRates,
      diningOptions,
      revenueCenters,
      salesCategories,
      priceGroups,
      serviceCharges,
      prepStations,
      voidReasons,
      noSaleReasons,
      alternatePaymentTypes,
      printers,
      discounts,
    })
  } catch (error) {
    console.error('Failed to fetch configuration:', error)
    return NextResponse.json({ error: 'Failed to fetch configuration' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json()
    const { model, data } = body

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

    const prismaModel = modelMap[model]
    if (!prismaModel) {
      return NextResponse.json({ error: `Unknown model: ${model}` }, { status: 400 })
    }

    const item = await (db as any)[prismaModel].create({ data })

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('Failed to create configuration item:', error)
    return NextResponse.json({ error: 'Failed to create configuration item' }, { status: 500 })
  }
}
