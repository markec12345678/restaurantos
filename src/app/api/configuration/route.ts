import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { NextResponse } from 'next/server'
import { z } from 'zod'

// FIX CRITICAL: Zahtevaj avtentikacijo za GET — konfiguracija vsebuje
// popuste, storno razloge, tiskalniške konfiguracije itd.
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error
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

    // FIX CRITICAL: Validiraj model in podatke preden jih posreduješ Prisma-ju
    // Prepreči injection in kreiranje napačnih entitet
    const allowedModels = [
      'tax-rates', 'dining-options', 'revenue-centers', 'sales-categories',
      'price-groups', 'service-charges', 'prep-stations', 'void-reasons',
      'no-sale-reasons', 'alternate-payment-types', 'printers', 'discounts',
    ] as const

    if (!allowedModels.includes(model)) {
      return NextResponse.json({ error: `Unknown model: ${model}` }, { status: 400 })
    }

    // FIX HIGH: Osnovna validacija — preveri, da data ni prazen in vsebuje vsaj 'name'
    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'Podatki so obvezni' }, { status: 400 })
    }

    // Bela lista dovoljenih polj za vsak model — prepreči injection polj
    const allowedFields: Record<string, string[]> = {
      'tax-rates': ['name', 'rate', 'code', 'isActive', 'sortOrder'],
      'dining-options': ['name', 'type', 'serviceChargeId', 'prepTimeMinutes', 'isActive', 'sortOrder'],
      'revenue-centers': ['name', 'code', 'isActive', 'sortOrder'],
      'sales-categories': ['name', 'code', 'isActive', 'sortOrder'],
      'price-groups': ['name', 'description', 'isActive', 'sortOrder'],
      'service-charges': ['name', 'type', 'amount', 'isAutoApply', 'isActive', 'sortOrder'],
      'prep-stations': ['name', 'type', 'avgPrepTime', 'isActive', 'sortOrder'],
      'void-reasons': ['name', 'isActive', 'sortOrder'],
      'no-sale-reasons': ['name', 'isActive', 'sortOrder'],
      'alternate-payment-types': ['name', 'code', 'type', 'isActive', 'sortOrder'],
      printers: ['name', 'type', 'location', 'ipAddress', 'printRules', 'isActive', 'sortOrder'],
      discounts: ['name', 'type', 'amount', 'appliesTo', 'triggerType', 'promoCode', 'maxUses', 'validFrom', 'validTo', 'isActive', 'sortOrder'],
    }

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

    // FIX CRITICAL: Filtriraj podatke — samo dovoljena polja gredo v Prisma
    const fields = allowedFields[model] || []
    const filteredData: Record<string, unknown> = {}
    for (const key of fields) {
      if (key in data) {
        filteredData[key] = data[key]
      }
    }

    // Prevzeti tipi za varno pretvorbo
    if (filteredData.rate !== undefined) filteredData.rate = Number(filteredData.rate)
    if (filteredData.amount !== undefined) filteredData.amount = Number(filteredData.amount)
    if (filteredData.sortOrder !== undefined) filteredData.sortOrder = Number(filteredData.sortOrder)
    if (filteredData.isActive !== undefined) filteredData.isActive = Boolean(filteredData.isActive)
    if (filteredData.isAutoApply !== undefined) filteredData.isAutoApply = Boolean(filteredData.isAutoApply)
    if (filteredData.avgPrepTime !== undefined) filteredData.avgPrepTime = Number(filteredData.avgPrepTime)
    if (filteredData.prepTimeMinutes !== undefined) filteredData.prepTimeMinutes = Number(filteredData.prepTimeMinutes)
    if (filteredData.maxUses !== undefined) filteredData.maxUses = Number(filteredData.maxUses) || null
    if (filteredData.validFrom !== undefined) filteredData.validFrom = filteredData.validFrom ? new Date(filteredData.validFrom as string) : null
    if (filteredData.validTo !== undefined) filteredData.validTo = filteredData.validTo ? new Date(filteredData.validTo as string) : null

    const item = await (db as any)[prismaModel].create({ data: filteredData })

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('Failed to create configuration item:', error)
    return NextResponse.json({ error: 'Failed to create configuration item' }, { status: 500 })
  }
}
