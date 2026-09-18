// Pomožne funkcije za configuration API — Shema in konstante

import { z } from 'zod'

// Zod validacijska shema za POST body
export const configPostSchema = z.object({
  model: z.enum([
    'tax-rates', 'dining-options', 'revenue-centers', 'sales-categories',
    'price-groups', 'service-charges', 'prep-stations', 'void-reasons',
    'no-sale-reasons', 'alternate-payment-types', 'printers', 'discounts',
  ], { message: 'Neveljaven model' }),
  data: z.record(z.string().max(100, 'Ime polja je predolgo'), z.unknown()).refine(d => Object.keys(d).length > 0, { message: 'Podatki ne smejo biti prazni' }).refine(d => Object.keys(d).length <= 50, { message: 'Preveč polj — največ 50 dovoljenih' }),
})

// Bela lista dovoljenih polj za vsak model — prepreči injection polj
// MODEL A (#8): FK reference (serviceChargeId, taxRateId) so dovoljene, a se
// v route.ts validira ISTA lokacija (cross-scope = 400).
export const allowedFields: Record<string, string[]> = {
  'tax-rates': ['name', 'rate', 'code', 'isActive', 'sortOrder'],
  'dining-options': ['name', 'type', 'serviceChargeId', 'taxRateId', 'prepTimeMinutes', 'isActive', 'sortOrder'],
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

export const modelMap: Record<string, string> = {
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

// Prevzeti tipi za varno pretvorbo
export function coerceFieldTypes(filteredData: Record<string, unknown>): Record<string, unknown> {
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
  // MODEL A (#8): prazen string FK = "ni nastavljeno" → null (ne prazna referenca)
  for (const fk of ['serviceChargeId', 'taxRateId'] as const) {
    if (filteredData[fk] !== undefined && filteredData[fk] === '') filteredData[fk] = null
  }
  return filteredData
}

// ============================================
// MODEL A (#8/#9): CROSS-SCOPE VALIDACIJA FK REFERENC
// Konfiguracija PO LOKACIJI sme referencirati SAMO zapise iste lokacije.
// DiningOption nosi taxRateId/serviceChargeId → cross-tenant referenca bi
// pomenila NAPAČEN DDV na fiskalnem računu (FURS!) ali tujo servisno
// postavko. Printer.printRules (JSON) lahko vsebuje prepStationId — postaja
// mora biti na isti lokaciji kot tiskalnik.
// Vrne { ok: true } ali { ok: false, error } — klicatelj vrne 400.
// ============================================

import { db } from '@/lib/db'
import { withLocationColumnFallback } from '@/lib/prisma-column-fallback'

// ============================================
// SKUPNA CREATE LOGIKA (runda 41) — root POST /api/configuration IN NOVI
// POST /api/configuration/[tab] delita isti potek: whitelist polj → coerce →
// MODEL A location resolve → FK cross-scope validacija → typed create switch.
// Root route ohrani zod {model,data} ovojnico; tab route sprejme tudi gol
// objekt. Zero novih route datotek (Vercel Hobby 242 cap).
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { resolveWriteLocationId, sessionLocationId } from '@/lib/tenant-scope'

/** Iz body izlušči konfiguracijske podatke: sprejme {data:{...}} ovojnico
 *  (root POST vzorec) ALI goli objekt (tab POST vzorec iz ConfigurationManager). */
export function extractConfigData(body: unknown): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Neveljaven body — pričakovan objekt' }
  }
  const b = body as Record<string, unknown>
  const candidate = (b.data && typeof b.data === 'object' && !Array.isArray(b.data))
    ? (b.data as Record<string, unknown>)
    : b
  const keys = Object.keys(candidate)
  if (keys.length === 0) return { ok: false, error: 'Podatki ne smejo biti prazni' }
  if (keys.length > 50) return { ok: false, error: 'Preveč polj — največ 50 dovoljenih' }
  return { ok: true, data: candidate }
}

type AuthResultLike = Awaited<ReturnType<typeof requireAuth>>

export async function createConfigItem(
  req: Request,
  model: string,
  configData: Record<string, unknown>,
  authResult: AuthResultLike,
): Promise<Response> {
  try {
    const prismaModel = modelMap[model]
    if (!prismaModel) {
      return NextResponse.json({ error: `Unknown model: ${model}` }, { status: 400 })
    }

    // FIX CRITICAL: Filtriraj podatke — samo dovoljena polja gredo v Prisma
    const fields = allowedFields[model] || []
    const filteredData: Record<string, unknown> = {}
    for (const key of fields) {
      if (key in configData) filteredData[key] = configData[key]
    }

    coerceFieldTypes(filteredData)

    // MODEL A: konfiguracija je PO LOKACIJI (NOT NULL) — locationId se izpelje
    // IZKLJUČNO iz seje (zaposleni) ali izrecnega ?locationId= (admin).
    // locationId NI v allowedFields — klient ga NE more podati sam (anti-forgery).
    const { searchParams } = new URL(req.url)
    const loc = resolveWriteLocationId(sessionLocationId(authResult), searchParams.get('locationId'))
    if (!loc.ok) return loc.response
    filteredData.locationId = loc.locationId

    // MODEL A (#8/#9): cross-scope validacija FK referenc — serviceChargeId /
    // taxRateId (DiningOption) in prepStationId (Printer.printRules) smejo
    // kazati SAMO na zapise ISTE lokacije. Cross-tenant DDV na fiskalnem
    // računu (FURS) ni sprejemljiv → 400.
    const refCheck = await validateConfigRefs(model, filteredData, loc.locationId)
    if (!refCheck.ok) {
      return NextResponse.json({ error: refCheck.error }, { status: 400 })
    }

    // FIX QA runda 39: 11/12 config tabel v Neonu nima stolpca locationId (P1054) —
    // most: ponovi brez locationId (vrstica postane globalna; trajno reši db push).
    const dataForCreate = (withLoc: boolean): Record<string, unknown> => {
      if (withLoc) return filteredData
      const { locationId: _drop, ...rest } = filteredData
      return rest
    }

    // FIX SECURITY: Uporabi type-safe switch namesto dinamičnega (db as any)[prismaModel]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let item: any
    item = await withLocationColumnFallback(`config:${model}`, async (withLoc) => {
      const data = dataForCreate(withLoc)
      switch (prismaModel) {
        case 'taxRate': item = await db.taxRate.create({ data: data as never }); break
        case 'diningOption': item = await db.diningOption.create({ data: data as never }); break
        case 'revenueCenter': item = await db.revenueCenter.create({ data: data as never }); break
        case 'salesCategory': item = await db.salesCategory.create({ data: data as never }); break
        case 'priceGroup': item = await db.priceGroup.create({ data: data as never }); break
        case 'serviceCharge': item = await db.serviceCharge.create({ data: data as never }); break
        case 'prepStation': item = await db.prepStation.create({ data: data as never }); break
        case 'voidReason': item = await db.voidReason.create({ data: data as never }); break
        case 'noSaleReason': item = await db.noSaleReason.create({ data: data as never }); break
        case 'alternatePaymentType': item = await db.alternatePaymentType.create({ data: data as never }); break
        case 'printer': item = await db.printer.create({ data: data as never }); break
        case 'discount': item = await db.discount.create({ data: data as never }); break
        default:
          return NextResponse.json({ error: `Unknown model: ${model}` }, { status: 400 })
      }
      return item
    })

    return NextResponse.json(item, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, `POST /api/configuration (${model})`, 'Failed to create configuration item')
  }
}

export type RefCheckResult = { ok: true } | { ok: false; error: string }

/** Normaliziraj id: prazen/whitespace string → null */
function refId(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length > 0 ? t : null
}

export async function validateConfigRefs(
  model: string,
  filteredData: Record<string, unknown>,
  locationId: string,
): Promise<RefCheckResult> {
  if (model === 'dining-options') {
    // serviceChargeId → ServiceCharge.locationId
    const scId = refId(filteredData.serviceChargeId)
    if (scId) {
      // FIX QA runda 39: ServiceCharge tabela v Neonu nima locationId stolpca (P1054) —
      // most: ponovi brez lokacijskega filtra (scope validacija oslabjena do db push)
      const sc = await withLocationColumnFallback('config-ref:serviceCharge', (withLoc) =>
        db.serviceCharge.findFirst({
          where: withLoc ? { id: scId, locationId } : { id: scId },
          select: { id: true },
        }))
      if (!sc) {
        return { ok: false, error: 'Servisna postavka ni na voljo na tej lokaciji (MODEL A: konfiguracija sme referencirati samo zapise iste lokacije)' }
      }
    }
    // taxRateId → TaxRate.locationId (F5-7 DDV override glede na način serviranja)
    const trId = refId(filteredData.taxRateId)
    if (trId) {
      const tr = await db.taxRate.findFirst({
        where: { id: trId, locationId },
        select: { id: true },
      })
      if (!tr) {
        return { ok: false, error: 'Davčna stopnja ni na voljo na tej lokaciji (MODEL A: konfiguracija sme referencirati samo zapise iste lokacije)' }
      }
    }
  }

  if (model === 'printers') {
    // printRules: JSON array [{type, prepStationId?, port?}] — oblika + scope
    const raw = filteredData.printRules
    if (raw !== undefined && raw !== null && raw !== '') {
      let rules: unknown
      try {
        rules = typeof raw === 'string' ? JSON.parse(raw) : raw
      } catch {
        return { ok: false, error: 'printRules ni veljaven JSON' }
      }
      if (!Array.isArray(rules) || rules.length > 50) {
        return { ok: false, error: 'printRules mora biti JSON array (max 50 pravil)' }
      }
      for (const r of rules) {
        if (typeof r !== 'object' || r === null) return { ok: false, error: 'printRules: vsako pravilo mora biti objekt' }
        const rule = r as Record<string, unknown>
        if (typeof rule.type !== 'string' || rule.type.trim() === '' || rule.type.length > 50) {
          return { ok: false, error: 'printRules: vsako pravilo potrebuje type (max 50 znakov)' }
        }
        const psId = refId(rule.prepStationId)
        if (psId) {
          const ps = await withLocationColumnFallback('config-ref:prepStation', (withLoc) =>
            db.prepStation.findFirst({
              where: withLoc ? { id: psId, locationId } : { id: psId },
              select: { id: true },
            }))
          if (!ps) {
            return { ok: false, error: 'Postaja priprave iz printRules ni na voljo na tej lokaciji (MODEL A)' }
          }
        }
        if (rule.port !== undefined && (typeof rule.port !== 'number' || !Number.isInteger(rule.port) || rule.port < 1 || rule.port > 65535)) {
          return { ok: false, error: 'printRules: port mora biti veljavna številka vrat (1–65535)' }
        }
      }
      // shranimo kot kanonični JSON string (schema tip)
      filteredData.printRules = JSON.stringify(rules)
    }
  }

  return { ok: true }
}
