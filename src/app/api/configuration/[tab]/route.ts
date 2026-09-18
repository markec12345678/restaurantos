// GET /api/configuration/[tab] — Vrni specifično kategorijo konfiguracije
//
// FIX NAPAKA 5 (HTTP 404): Komponente so klicale /api/configuration/dining-options,
// /api/configuration/price-groups, /api/configuration/void-reasons,
// /api/configuration/alt-payment-types — ki prej niso obstajale kot ločeni route-i.
//
// Ta route shrani konfiguracijo specifično za podan tab parameter in vrne
// samo tiste podatke, ki jih komponenta potrebuje.
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { modelMap, allowedFields, coerceFieldTypes, validateConfigRefs, createConfigItem, extractConfigData } from '../_helpers'
import { sessionLocationId, locationFilter } from '@/lib/tenant-scope'
import { withLocationColumnFallback } from '@/lib/prisma-column-fallback'

export const dynamic = 'force-dynamic'

// Mapiranje tab → Prisma model + select polja
const tabConfig: Record<string, {
  model: string
  select: Record<string, boolean>
  include?: Record<string, unknown>
  orderBy?: Record<string, string>
}> = {
  'dining-options': {
    model: 'diningOption',
    select: { id: true, name: true, type: true, serviceChargeId: true, taxRateId: true, prepTimeMinutes: true, isActive: true, sortOrder: true },
    include: { serviceCharge: { select: { id: true, name: true, type: true, amount: true } } },
    orderBy: { sortOrder: 'asc' },
  },
  'price-groups': {
    model: 'priceGroup',
    select: { id: true, name: true, description: true, isActive: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
  'void-reasons': {
    model: 'voidReason',
    select: { id: true, name: true, isActive: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
  'no-sale-reasons': {
    model: 'noSaleReason',
    select: { id: true, name: true, isActive: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
  'alt-payment-types': {
    model: 'alternatePaymentType',
    select: { id: true, name: true, code: true, type: true, isActive: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
  'tax-rates': {
    model: 'taxRate',
    select: { id: true, name: true, rate: true, code: true, isActive: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
  'revenue-centers': {
    model: 'revenueCenter',
    select: { id: true, name: true, isActive: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
  'sales-categories': {
    model: 'salesCategory',
    select: { id: true, name: true, isActive: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
  'service-charges': {
    model: 'serviceCharge',
    select: { id: true, name: true, type: true, amount: true, isAutoApply: true, isActive: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
  'prep-stations': {
    model: 'prepStation',
    select: { id: true, name: true, type: true, avgPrepTime: true, isActive: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
  printers: {
    model: 'printer',
    select: { id: true, name: true, type: true, location: true, ipAddress: true, printRules: true, isActive: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
  discounts: {
    model: 'discount',
    select: { id: true, name: true, type: true, amount: true, appliesTo: true, triggerType: true, isActive: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  },
}

// GET — vrni specifično konfiguracijo za tab
export async function GET(req: Request, { params }: { params: Promise<{ tab: string }> }) {
  try {
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    const { tab } = await params
    const config = tabConfig[tab]
    if (!config) {
      return NextResponse.json(
        { error: `Neveljaven konfiguracijski tab: ${tab}` },
        { status: 400 }
      )
    }

    // Dynamic Prisma query — model ime iz tabConfig
    const prismaModel = modelMap[tab] || config.model
    const prisma = (db as unknown as Record<string, unknown>)[prismaModel] as
      | { findMany: (args: Record<string, unknown>) => Promise<unknown[]> }
      | undefined

    if (!prisma || typeof prisma.findMany !== 'function') {
      return NextResponse.json(
        { error: `Model '${prismaModel}' ni na voljo` },
        { status: 500 }
      )
    }

    // MODEL A: konfiguracija PO LOKACIJI — zaposleni dobi SAMO svojo (prej: vsi
    // najemniki). Admin brez lokacije = cross-lokacijski nadzor.
    const locWhere = locationFilter(sessionLocationId(authResult))
    const result = await prisma.findMany({
      where: locWhere,
      select: config.select,
      orderBy: config.orderBy || { sortOrder: 'asc' },
      ...(config.include ? { include: config.include } : {}),
    })

    // Vrni v objektu z imenom tab-a kot ključem (konsistentno s /api/configuration)
    // npr. { diningOptions: [...] }, { priceGroups: [...] }
    // Uporabljamo camelCase ime iz modelMap
    const responseKey = prismaModel.charAt(0).toLowerCase() + prismaModel.slice(1)
    // Poseben primer: alternatePaymentType → alternatePaymentTypes (množina)
    const finalKey = responseKey.endsWith('s') ? responseKey : `${responseKey}s`
    return NextResponse.json({ [finalKey]: deepToNumbers(result) })
  } catch (error: unknown) {
    return handleApiError(error, `GET /api/configuration/${(await params).tab}`, 'Napaka pri pridobivanju konfiguracije')
  }
}

// ============================================
// RUNDA 41: POST / PUT / DELETE na tab route — Konfiguracija UI je imel VSE
// tri mutacije MRTEV (create POST /api/configuration/<tab> = 405; edit PUT in
// delete DELETE /api/configuration/<tab>/<id> = 404 HTML — [id] route ni
// obstajal). Novi handlerji živijo V TEM datoteki (zero novih route datotek,
// Vercel Hobby 242 cap) in uporabljajo ?id= query namesto [id] poti.
// ============================================

/** Skupni scope-check za PUT/DELETE: zapis obstaja + lokacijska lastništva.
 *  Admin brez seje lokacije sme urejati vse; zaposleni SAMO svojo lokacijo. */
async function loadScopedItem(
  prismaModel: string,
  id: string,
  sessLoc: string | null,
): Promise<{ item: Record<string, unknown> | null; error?: string; status?: number }> {
  // findUnique z locationId selectom — ob morebitnem P2022 (stolpec še ne
  // obstaja) most ponovi brez locationId (obstoj zapis ostane resnica).
  const delegate = (db as unknown as Record<string, {
    findUnique: (args: Record<string, unknown>) => Promise<unknown>
  } | undefined>)[prismaModel]
  if (!delegate || typeof delegate.findUnique !== 'function') {
    return { item: null, error: `Model '${prismaModel}' ni na voljo`, status: 500 }
  }
  const item = await withLocationColumnFallback(`config-scope:${prismaModel}`, async (withLoc) =>
    delegate.findUnique({ where: { id }, select: withLoc ? { id: true, locationId: true } : { id: true } })
  ) as Record<string, unknown> | null
  if (!item) return { item: null, error: 'Zapis ne obstaja', status: 404 }
  const itemLoc = typeof item.locationId === 'string' ? item.locationId : null
  if (sessLoc && itemLoc && itemLoc !== sessLoc) {
    return { item: null, error: 'Zapis pripada drugi lokaciji (MODEL A: brez cross-lokacijskih sprememb)', status: 403 }
  }
  return { item }
}

/** Tab → scope lokacija za FK validacijo (seja → zapis → null = preskoči). */
function resolveScopeLocation(sessLoc: string | null, item: Record<string, unknown>): string | null {
  if (sessLoc) return sessLoc
  const itemLoc = typeof item.locationId === 'string' ? item.locationId : null
  return itemLoc && itemLoc.length > 0 ? itemLoc : null
}

// POST — ustvari nov zapis v tem tab-u. Sprejme goli objekt (UI vzorec) ALI
// {data:{...}} ovojnice (root POST vzorec). Deli celoten MODEL A potek.
export async function POST(req: Request, { params }: { params: Promise<{ tab: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { tab } = await params
    if (!modelMap[tab]) {
      return NextResponse.json({ error: `Neveljaven konfiguracijski tab: ${tab}` }, { status: 400 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Neveljaven JSON' }, { status: 400 })
    }
    const extracted = extractConfigData(body)
    if (!extracted.ok) {
      return NextResponse.json({ error: extracted.error }, { status: 400 })
    }

    return await createConfigItem(req, tab, extracted.data, authResult)
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/configuration/[tab]', 'Napaka pri ustvarjanju konfiguracije')
  }
}

// PUT — posodobi zapis: PUT /api/configuration/<tab>?id=<id>
// Whitelist polj (allowedFields) + coerce + FK cross-scope validacija.
// locationId NI nadgradljiv (anti-forgery, MODEL A).
export async function PUT(req: Request, { params }: { params: Promise<{ tab: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { tab } = await params
    const config = tabConfig[tab]
    const prismaModel = modelMap[tab]
    if (!config || !prismaModel) {
      return NextResponse.json({ error: `Neveljaven konfiguracijski tab: ${tab}` }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Manjka id — uporabi ?id=<zapis>' }, { status: 400 })

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Neveljaven JSON' }, { status: 400 })
    }
    const extracted = extractConfigData(body)
    if (!extracted.ok) {
      return NextResponse.json({ error: extracted.error }, { status: 400 })
    }

    const sessLoc = sessionLocationId(authResult)
    const scoped = await loadScopedItem(prismaModel, id, sessLoc)
    if (!scoped.item) {
      return NextResponse.json({ error: scoped.error ?? 'Zapis ne obstaja' }, { status: scoped.status ?? 404 })
    }

    const fields = allowedFields[tab] || []
    const filteredData: Record<string, unknown> = {}
    for (const key of fields) {
      if (key in extracted.data) filteredData[key] = extracted.data[key]
    }
    // locationId NI v allowedFields (anti-forgery) — obrambno še enkrat izpusti
    delete filteredData.locationId
    coerceFieldTypes(filteredData)
    if (Object.keys(filteredData).length === 0) {
      return NextResponse.json({ error: 'Ni prepoznavnih polj za posodobitev' }, { status: 400 })
    }

    const scopeLoc = resolveScopeLocation(sessLoc, scoped.item)
    if (scopeLoc) {
      const refCheck = await validateConfigRefs(tab, filteredData, scopeLoc)
      if (!refCheck.ok) {
        return NextResponse.json({ error: refCheck.error }, { status: 400 })
      }
    }

    // Type-safe update switch (isti vzorec kot create switch)
    const data = filteredData
    let item: unknown
    switch (prismaModel) {
      case 'taxRate': item = await db.taxRate.update({ where: { id }, data: data as never }); break
      case 'diningOption': item = await db.diningOption.update({ where: { id }, data: data as never }); break
      case 'revenueCenter': item = await db.revenueCenter.update({ where: { id }, data: data as never }); break
      case 'salesCategory': item = await db.salesCategory.update({ where: { id }, data: data as never }); break
      case 'priceGroup': item = await db.priceGroup.update({ where: { id }, data: data as never }); break
      case 'serviceCharge': item = await db.serviceCharge.update({ where: { id }, data: data as never }); break
      case 'prepStation': item = await db.prepStation.update({ where: { id }, data: data as never }); break
      case 'voidReason': item = await db.voidReason.update({ where: { id }, data: data as never }); break
      case 'noSaleReason': item = await db.noSaleReason.update({ where: { id }, data: data as never }); break
      case 'alternatePaymentType': item = await db.alternatePaymentType.update({ where: { id }, data: data as never }); break
      case 'printer': item = await db.printer.update({ where: { id }, data: data as never }); break
      case 'discount': item = await db.discount.update({ where: { id }, data: data as never }); break
      default:
        return NextResponse.json({ error: `Unknown model: ${prismaModel}` }, { status: 400 })
    }

    return NextResponse.json(deepToNumbers(item))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/configuration/[tab]', 'Napaka pri posodabljanju konfiguracije')
  }
}

// DELETE — izbriši zapis: DELETE /api/configuration/<tab>?id=<id>
// FK zaščita: če je zapis referenciran (P2003 — npr. DDV na naročilih), ga
// NE izbrišemo ampak DEAKTIVIRAMO (isActive=false) — revizijska sled ostane
// nedotaknjena (fiskalni podatki se ne smejo izgubiti).
export async function DELETE(req: Request, { params }: { params: Promise<{ tab: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { tab } = await params
    const config = tabConfig[tab]
    const prismaModel = modelMap[tab]
    if (!config || !prismaModel) {
      return NextResponse.json({ error: `Neveljaven konfiguracijski tab: ${tab}` }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Manjka id — uporabi ?id=<zapis>' }, { status: 400 })

    const sessLoc = sessionLocationId(authResult)
    const scoped = await loadScopedItem(prismaModel, id, sessLoc)
    if (!scoped.item) {
      return NextResponse.json({ error: scoped.error ?? 'Zapis ne obstaja' }, { status: scoped.status ?? 404 })
    }

    const softDelete = async (): Promise<unknown> => {
      const data = { isActive: false }
      switch (prismaModel) {
        case 'taxRate': return db.taxRate.update({ where: { id }, data })
        case 'diningOption': return db.diningOption.update({ where: { id }, data })
        case 'revenueCenter': return db.revenueCenter.update({ where: { id }, data })
        case 'salesCategory': return db.salesCategory.update({ where: { id }, data })
        case 'priceGroup': return db.priceGroup.update({ where: { id }, data })
        case 'serviceCharge': return db.serviceCharge.update({ where: { id }, data })
        case 'prepStation': return db.prepStation.update({ where: { id }, data })
        case 'voidReason': return db.voidReason.update({ where: { id }, data })
        case 'noSaleReason': return db.noSaleReason.update({ where: { id }, data })
        case 'alternatePaymentType': return db.alternatePaymentType.update({ where: { id }, data })
        case 'printer': return db.printer.update({ where: { id }, data })
        case 'discount': return db.discount.update({ where: { id }, data })
        default: throw new Error(`Unknown model: ${prismaModel}`)
      }
    }

    const hardDelete = async (): Promise<unknown> => {
      switch (prismaModel) {
        case 'taxRate': return db.taxRate.delete({ where: { id } })
        case 'diningOption': return db.diningOption.delete({ where: { id } })
        case 'revenueCenter': return db.revenueCenter.delete({ where: { id } })
        case 'salesCategory': return db.salesCategory.delete({ where: { id } })
        case 'priceGroup': return db.priceGroup.delete({ where: { id } })
        case 'serviceCharge': return db.serviceCharge.delete({ where: { id } })
        case 'prepStation': return db.prepStation.delete({ where: { id } })
        case 'voidReason': return db.voidReason.delete({ where: { id } })
        case 'noSaleReason': return db.noSaleReason.delete({ where: { id } })
        case 'alternatePaymentType': return db.alternatePaymentType.delete({ where: { id } })
        case 'printer': return db.printer.delete({ where: { id } })
        case 'discount': return db.discount.delete({ where: { id } })
        default: throw new Error(`Unknown model: ${prismaModel}`)
      }
    }

    let item: unknown
    let softDeleted = false
    try {
      item = await hardDelete()
    } catch (delError: unknown) {
      // R39 lekcija: instanceof PrismaClientKnownRequestError NE DELUJE v Next
      // bundleju (dual-copy @prisma/client) — vedno duck-typing po .code/.message.
      const code = (delError as { code?: string }).code
      const msg = delError instanceof Error ? delError.message : String(delError)
      const fkViolation = code === 'P2003' || msg.includes('P2003') || msg.includes('Foreign key constraint')
      if (!fkViolation) throw delError
      // FK zaščita — deaktiviraj namesto izbrisa (fiskalna revizijska sled)
      item = await softDelete()
      softDeleted = true
    }

    return NextResponse.json({ success: true, softDeleted, item: deepToNumbers(item) })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/configuration/[tab]', 'Napaka pri brisanju konfiguracije')
  }
}
