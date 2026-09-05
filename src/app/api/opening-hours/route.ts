import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth, resolveTenantLocationId, tenantScopeToWhere } from '@/lib/auth-middleware'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'

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
      const locId = batchData.locationId
      if (locId) {
        await db.openingHours.deleteMany({ where: { locationId: locId } })
      } else {
        await db.openingHours.deleteMany({ where: { locationId: null } })
      }

      const created = await db.openingHours.createMany({
        data: batchData.hours.map(h => ({
          ...h,
          locationId: locId,
        })),
      })

      return NextResponse.json({ created: created.count }, { status: 201 })
    }

    // Single day creation
    const hours = await db.openingHours.create({ data: validatedData as z.infer<typeof openingHoursSchema> })
    return NextResponse.json(hours, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/opening-hours', 'Napaka pri ustvarjanju delovnega časa')
  }
}
