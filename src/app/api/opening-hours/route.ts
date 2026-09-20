import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth, resolveTenantLocationId, tenantScopeToWhere } from '@/lib/auth-middleware'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { resolveWriteLocationId } from '@/lib/tenant-scope'

// =====================================================================
// OPENING HOURS API — CRUD za delovni čas lokacij
// Podpora za urnike po dnevih s premori
// =====================================================================

const openingHoursSchema = z.object({
  dayOfWeek: z.number().int().min(0, 'Dan v tednu mora biti 0-6').max(6, 'Dan v tednu mora biti 0-6'),
  openTime: z.string().max(10, 'Odpiralni čas ne sme preseči 10 znakov').default('08:00'),
  closeTime: z.string().max(10, 'Zapiralni čas ne sme preseči 10 znakov').default('22:00'),
  breakStart: z.string().max(10, 'Začetek odmora ne sme preseči 10 znakov').default(''),
  breakEnd: z.string().max(10, 'Konec odmora ne sme preseči 10 znakov').default(''),
  isClosed: z.boolean().default(false),
  locationId: z.string().max(100, 'ID lokacije ne sme preseči 100 znakov').nullable().optional(),
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used on line 69 for type inference
const batchSchema = z.object({
  hours: z.array(openingHoursSchema).min(1, 'Vsaj en dan je obvezen').max(7, 'Največ 7 dni'),
  locationId: z.string().max(100, 'ID lokacije ne sme preseči 100 znakov').nullable().optional(),
})

// GET /api/opening-hours
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const url = new URL(req.url)

    // FIX P0-C2: Centralni tenant scope resolver — fail-closed, no ?locationId bypass
    const scope = resolveTenantLocationId(authResult.session, url.searchParams, {
      endpoint: 'GET /api/opening-hours',
    })
    if (!scope.ok) return scope.error

    const where = tenantScopeToWhere(scope)
    const hours = await db.openingHours.findMany({
      where,
      orderBy: { dayOfWeek: 'asc' },
    })

    return NextResponse.json({ hours })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/opening-hours', 'Napaka pri pridobivanju delovnega časa')
  }
}

// POST /api/opening-hours — Ustvari en dan ali batch 7 dni
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // FIX R86-2c1 (M2): centralni resolver TAKOJ za requireAuth (scope pred
    // body parse). Prej je raw `session?.locationId || null` dopuščal
    // non-admin sejo z 'admin' permissionom in NULL lokacijo do poljubnega
    // body.locationId (deleteMany+recreate tuje lokacije). Zdaj: regular/
    // manager NULL → 403 fail-closed; admin/super-admin brez lokacije sme
    // izrecen body.locationId (MODEL A write semantika).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'POST /api/opening-hours',
    })
    if ('error' in scope) return scope.error

    // Use a union schema to support both batch and single-day creation
    const combinedSchema = z.union([
      z.object({
        hours: z.array(openingHoursSchema).min(1, 'Vsaj en dan je obvezen').max(7, 'Največ 7 dni'),
        locationId: z.string().max(100, 'ID lokacije ne sme preseči 100 znakov').nullable().optional(),
      }),
      openingHoursSchema,
    ])

    const { data: validatedData, error: validationError } = await validateRequest(req, combinedSchema)
    if (validationError) return validationError

    // Determine if batch or single
    const isBatch = 'hours' in validatedData && Array.isArray(validatedData.hours)

    if (isBatch) {
      const batchData = validatedData as z.infer<typeof batchSchema>
      // Delete existing hours for this location and recreate
      // FIX R82-F (LEAK-HIGH): body.locationId je bil RAW — lokacijsko vezan
      // admin je lahko deleteMany + recreate TUJO lokacijo (izbris tujega
      // delovnega časa). Zdaj: lokacijsko vezana seja je VEDNO pripeta na
      // svojo lokacijo (body strip); super-admin sme izrecen body.locationId.
      // FIX R86-2c1 (M2): sessionLocId iz resolverja (fail-closed za NULL
      // non-admin sejo — prej raw `|| null`).
      // FIX R87-4 (LOW preostanek): NIČ več resolveLocationId globalnega
      // prva-lokacija fallback-a — super-admin brez izrecne lokacije (query ALI
      // body) dobi 400 fail-closed (prej: PRVA lokacija KATEREGA KOLI tenanta =
      // deleteMany + recreate tuje lokacije). resolveWriteLocationId: scope
      // (session/?locationId) zmaga, sicer body.locationId (super-admin), sicer 400.
      const writeLoc = resolveWriteLocationId(scope.locationId, batchData.locationId)
      if (!writeLoc.ok) return writeLoc.response
      const batchLocationId = writeLoc.locationId
      // batchLocationId je po R87-4 VEDNO niz — legacy veja "brez lokacije v DB"
      // (deleteMany { locationId: null }) je nedosegljiva in odstranjena.
      await db.openingHours.deleteMany({ where: { locationId: batchLocationId } })

      // FIX QA runda 37: DB stolpec OpeningHours.locationId je NOT NULL (schema drift)
      const created = await db.openingHours.createMany({
        data: batchData.hours.map(h => ({
          ...h,
          locationId: batchLocationId,
        })),
      })

      return NextResponse.json({ created: created.count }, { status: 201 })
    }

    // Single day creation
    // FIX QA runda 37: NOT NULL drift — fallback, če body nima lokacije
    // FIX R82-F: isti strip — lokacijsko vezana seja ne sme izbrati tuje lokacije
    // FIX R86-2c1 (M2): scope iz resolverja (non-admin NULL → 403 pred zapisom;
    // prej je raw session check spustil body.locationId skozi).
    const singleData = validatedData as z.infer<typeof openingHoursSchema>
    if (scope.locationId) {
      singleData.locationId = scope.locationId
    } else if (!singleData.locationId) {
      // FIX R87-4 (LOW preostanek): super-admin brez izrecne lokacije → 400
      // fail-closed (prej: resolveLocationId globalni prva-lokacija stamp).
      const writeLoc = resolveWriteLocationId(scope.locationId)
      if (!writeLoc.ok) return writeLoc.response
      singleData.locationId = writeLoc.locationId
    }
    const hours = await db.openingHours.create({ data: singleData })
    return NextResponse.json(hours, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/opening-hours', 'Napaka pri ustvarjanju delovnega časa')
  }
}
