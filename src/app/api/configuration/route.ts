import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'
// Zod validacijska shema za POST body
const configPostSchema = z.object({
  model: z.enum([
    'tax-rates', 'dining-options', 'revenue-centers', 'sales-categories',
    'price-groups', 'service-charges', 'prep-stations', 'void-reasons',
    'no-sale-reasons', 'alternate-payment-types', 'printers', 'discounts',
  ], { message: 'Neveljaven model' }),
  data: z.record(z.string().max(100, 'Ime polja je predolgo'), z.unknown()).refine(d => Object.keys(d).length > 0, { message: 'Podatki ne smejo biti prazni' }).refine(d => Object.keys(d).length <= 50, { message: 'Preveč polj — največ 50 dovoljenih' }),
})

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
      db.taxRate.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, rate: true, code: true, isActive: true, sortOrder: true } }),
      db.diningOption.findMany({
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, isActive: true, sortOrder: true, serviceChargeId: true, serviceCharge: { select: { id: true, name: true, type: true, amount: true } } },
      }),
      db.revenueCenter.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, isActive: true, sortOrder: true } }),
      db.salesCategory.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, isActive: true, sortOrder: true } }),
      db.priceGroup.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, description: true, isActive: true, sortOrder: true } }),
      db.serviceCharge.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, type: true, amount: true, isAutoApply: true, isActive: true, sortOrder: true } }),
      db.prepStation.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, type: true, avgPrepTime: true, isActive: true, sortOrder: true } }),
      db.voidReason.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, isActive: true, sortOrder: true } }),
      db.noSaleReason.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, isActive: true, sortOrder: true } }),
      db.alternatePaymentType.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, type: true, isActive: true, sortOrder: true } }),
      db.printer.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, type: true, location: true, ipAddress: true, printRules: true, isActive: true, sortOrder: true } }),
      db.discount.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, type: true, amount: true, appliesTo: true, triggerType: true, isActive: true, sortOrder: true } }),
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
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/configuration', 'Failed to fetch configuration')
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { data, error: validationError } = await validateRequest(req, configPostSchema)
    if (validationError) return validationError

    const { model, data: configData } = data

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
      if (key in configData) {
        filteredData[key] = configData[key]
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

    // FIX SECURITY: Uporabi type-safe switch namesto dinamičnega (db as any)[prismaModel]
    // Prepreči potencialni injection prek model imena
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma create input requires specific types that Record<string, unknown> can't satisfy
    let item: any
    switch (prismaModel) {
      case 'taxRate': item = await db.taxRate.create({ data: filteredData as any }); break // eslint-disable-line @typescript-eslint/no-explicit-any
      case 'diningOption': item = await db.diningOption.create({ data: filteredData as any }); break // eslint-disable-line @typescript-eslint/no-explicit-any
      case 'revenueCenter': item = await db.revenueCenter.create({ data: filteredData as any }); break // eslint-disable-line @typescript-eslint/no-explicit-any
      case 'salesCategory': item = await db.salesCategory.create({ data: filteredData as any }); break // eslint-disable-line @typescript-eslint/no-explicit-any
      case 'priceGroup': item = await db.priceGroup.create({ data: filteredData as any }); break // eslint-disable-line @typescript-eslint/no-explicit-any
      case 'serviceCharge': item = await db.serviceCharge.create({ data: filteredData as any }); break // eslint-disable-line @typescript-eslint/no-explicit-any
      case 'prepStation': item = await db.prepStation.create({ data: filteredData as any }); break // eslint-disable-line @typescript-eslint/no-explicit-any
      case 'voidReason': item = await db.voidReason.create({ data: filteredData as any }); break // eslint-disable-line @typescript-eslint/no-explicit-any
      case 'noSaleReason': item = await db.noSaleReason.create({ data: filteredData as any }); break // eslint-disable-line @typescript-eslint/no-explicit-any
      case 'alternatePaymentType': item = await db.alternatePaymentType.create({ data: filteredData as any }); break // eslint-disable-line @typescript-eslint/no-explicit-any
      case 'printer': item = await db.printer.create({ data: filteredData as any }); break // eslint-disable-line @typescript-eslint/no-explicit-any
      case 'discount': item = await db.discount.create({ data: filteredData as any }); break // eslint-disable-line @typescript-eslint/no-explicit-any
      default:
        return NextResponse.json({ error: `Unknown model: ${model}` }, { status: 400 })
    }

    return NextResponse.json(item, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/configuration', 'Failed to create configuration item')
  }
}
