import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { configPostSchema, allowedFields, modelMap, coerceFieldTypes, validateConfigRefs } from './_helpers'
import { withETag } from '@/lib/middleware/cache-headers'
import { sessionLocationId, locationFilter, resolveWriteLocationId } from '@/lib/tenant-scope'
import { withLocationColumnFallback, isMissingLocationColumnError } from '@/lib/prisma-column-fallback'


// FIX CRITICAL: Zahtevaj avtentikacijo za GET — konfiguracija vsebuje
// popuste, storno razloge, tiskalniške konfiguracije itd.
export const dynamic = 'force-dynamic'


// FIX QA runda 39: 11 konfiguracijskih tabel v Neonu SE nima stolpca locationId
// (P1054 "column does not exist") — za zaposlenega z lokacijo bi celoten GET
// padel. Most: pri P1054 ponovi batch brez filtra (prod realnost = 1 lokacija;
// trajna resitev = prisma db push). Gl. src/lib/prisma-column-fallback.ts
async function fetchConfigBatch(w: Record<string, unknown>) {
  const run = () => Promise.all([
            db.taxRate.findMany({ where: w, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, rate: true, code: true, isActive: true, sortOrder: true } }),
      db.diningOption.findMany({
        where: w,
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, isActive: true, sortOrder: true, serviceChargeId: true, taxRateId: true, serviceCharge: { select: { id: true, name: true, type: true, amount: true } } },
      }),
      db.revenueCenter.findMany({ where: w, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, isActive: true, sortOrder: true } }),
      db.salesCategory.findMany({ where: w, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, isActive: true, sortOrder: true } }),
      db.priceGroup.findMany({ where: w, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, description: true, isActive: true, sortOrder: true } }),
      db.serviceCharge.findMany({ where: w, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, type: true, amount: true, isAutoApply: true, isActive: true, sortOrder: true } }),
      db.prepStation.findMany({ where: w, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, type: true, avgPrepTime: true, isActive: true, sortOrder: true } }),
      db.voidReason.findMany({ where: w, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, isActive: true, sortOrder: true } }),
      db.noSaleReason.findMany({ where: w, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, isActive: true, sortOrder: true } }),
      db.alternatePaymentType.findMany({ where: w, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, type: true, isActive: true, sortOrder: true } }),
      db.printer.findMany({ where: w, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, type: true, location: true, ipAddress: true, printRules: true, isActive: true, sortOrder: true } }),
      db.discount.findMany({ where: w, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, type: true, amount: true, appliesTo: true, triggerType: true, isActive: true, sortOrder: true } }),
  ])
  try {
    return await run()
  } catch (e) {
    if (!isMissingLocationColumnError(e)) throw e
    console.warn('[column-fallback] configuration GET: locationId stolpec manjka — batch brez filtra (db push to odpravi)')
    return await run()
  }
}

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    // MODEL A (tenant scope audit 2026-09-09): VSA konfiguracija je PO LOKACIJI.
    // Prej: findMany BREZ where je izpisal konfiguracijo VSEH lokacij/najemnikov
    // (cross-tenant leak) + globalne vrstice. Zaposleni = SAMO svoja lokacija;
    // admin brez lokacije = cross-lokacijski nadzor (vidi vse).
    const locWhere = locationFilter(sessionLocationId(authResult))
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
    ] = await fetchConfigBatch(locWhere)

    const responseBody = {
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
    }
    // FIX P15: ETag za configuration — konfiguracija se redko spreminja
    return withETag(req, NextResponse.json(responseBody), responseBody)
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

    coerceFieldTypes(filteredData)

    // MODEL A: konfiguracija je PO LOKACIJI (NOT NULL) — locationId se izpelje
    // IZKLJUČNO iz seje (zaposleni) ali izrecnega ?locationId= (admin).
    // locationId NI v allowedFields — klient ga NE more podati sam (anti-forgery).
    const { searchParams } = new URL(req.url)
    const loc = resolveWriteLocationId(sessionLocationId(authResult), searchParams.get('locationId'))
    if (!loc.ok) return loc.response
    filteredData.locationId = loc.locationId

    // FIX QA runda 39: 11/12 config tabel v Neonu nima stolpca locationId (P1054) —
    // most: ponovi brez locationId (vrstica postane globalna; trajno reši db push).
    const dataForCreate = (withLoc: boolean): Record<string, unknown> => {
      if (withLoc) return filteredData
      const { locationId: _drop, ...rest } = filteredData
      return rest
    }

    // MODEL A (#8/#9): cross-scope validacija FK referenc — serviceChargeId /
    // taxRateId (DiningOption) in prepStationId (Printer.printRules) smejo
    // kazati SAMO na zapise ISTE lokacije. Cross-tenant DDV na fiskalnem
    // računu (FURS) ni sprejemljiv → 400.
    const refCheck = await validateConfigRefs(model, filteredData, loc.locationId)
    if (!refCheck.ok) {
      return NextResponse.json({ error: refCheck.error }, { status: 400 })
    }

    // FIX SECURITY: Uporabi type-safe switch namesto dinamičnega (db as any)[prismaModel]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let item: any
    item = await withLocationColumnFallback(`config:${model}`, async (withLoc) => {
    const data = dataForCreate(withLoc)
    switch (prismaModel) {
      case 'taxRate': item = await db.taxRate.create({ data: data as any }); break // eslint-disable-line @typescript-eslint/no-explicit-any
      case 'diningOption': item = await db.diningOption.create({ data: data as any }); break // eslint-disable-line @typescript-eslint/no-explicit-any
      case 'revenueCenter': item = await db.revenueCenter.create({ data: data as any }); break // eslint-disable-line @typescript-eslint/no-explicit-any
      case 'salesCategory': item = await db.salesCategory.create({ data: data as any }); break // eslint-disable-line @typescript-eslint/no-explicit-any
      case 'priceGroup': item = await db.priceGroup.create({ data: data as any }); break // eslint-disable-line @typescript-eslint/no-explicit-any
      case 'serviceCharge': item = await db.serviceCharge.create({ data: data as any }); break // eslint-disable-line @typescript-eslint/no-explicit-any
      case 'prepStation': item = await db.prepStation.create({ data: data as any }); break // eslint-disable-line @typescript-eslint/no-explicit-any
      case 'voidReason': item = await db.voidReason.create({ data: data as any }); break // eslint-disable-line @typescript-eslint/no-explicit-any
      case 'noSaleReason': item = await db.noSaleReason.create({ data: data as any }); break // eslint-disable-line @typescript-eslint/no-explicit-any
      case 'alternatePaymentType': item = await db.alternatePaymentType.create({ data: data as any }); break // eslint-disable-line @typescript-eslint/no-explicit-any
      case 'printer': item = await db.printer.create({ data: data as any }); break // eslint-disable-line @typescript-eslint/no-explicit-any
      case 'discount': item = await db.discount.create({ data: data as any }); break // eslint-disable-line @typescript-eslint/no-explicit-any
      default:
        return NextResponse.json({ error: `Unknown model: ${model}` }, { status: 400 })
    }
    return item as any
    })

    return NextResponse.json(item, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/configuration', 'Failed to create configuration item')
  }
}
