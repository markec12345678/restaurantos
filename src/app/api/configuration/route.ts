import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { configPostSchema, createConfigItem } from './_helpers'
import { withETag } from '@/lib/middleware/cache-headers'
import { sessionLocationId, locationFilter } from '@/lib/tenant-scope'
import { isMissingLocationColumnError } from '@/lib/prisma-column-fallback'
import { logger } from '@/lib/logger'


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
    // FIX lint (no-console): strukturirani logger namesto console.warn
    logger.warn('column-fallback', 'configuration GET: locationId stolpec manjka — batch brez filtra (db push to odpravi)')
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

    // RUNDA 41: create logika preseljena v _helpers.createConfigItem — deljena
    // z novim POST /api/configuration/[tab] (Konfiguracija UI create je bil mrtev:
    // POST na [tab] = 405). Vedenje root route-a ostaja identično (zod ovojnica).
    return await createConfigItem(req, data.model, data.data, authResult)
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/configuration', 'Failed to create configuration item')
  }
}
