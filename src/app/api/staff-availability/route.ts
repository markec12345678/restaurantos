// ============================================
// /api/staff-availability — CRUD za razpoložljivost zaposlenih
// ============================================
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { isWithinScope, notInScopeResponse } from '@/lib/tenant-scope'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  employeeId: z.string().min(1).max(100),
  dayOfWeek: z.number().int().min(0).max(6), // 0=nedelja ... 6=sobota
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM'),
  isPreferred: z.boolean().default(true),
  notes: z.string().max(500).default(''),
})

// GET — pridobi razpoložljivost (filter po employeeId)
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    // FIX R85-4b MEDIUM: Tenant scope — StaffAvailability NIMA lastnega locationId
    // (schema.prisma:1636), scope se izpelje prek employee.locationId. Prej je
    // findMany zajel razpoložljivost VSEH tenantov. Fail-closed za regular
    // uporabnika brez lokacije; null scope (super-admin) = globalni pogled
    // (nikoli { employee: { locationId: null } }).
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/staff-availability',
    })
    if ('error' in scope) return scope.error

    const employeeId = searchParams.get('employeeId')

    const where: Record<string, unknown> = {
      // R85: tenant filter prek izpeljane verige Employee.locationId
      // (null scope = PRAZEN filter, nikoli { locationId: null })
      ...(scope.locationId ? { employee: { locationId: scope.locationId } } : {}),
    }
    if (employeeId) where.employeeId = employeeId

    const availability = await db.staffAvailability.findMany({
      where,
      include: { employee: { select: { id: true, name: true } } },
      orderBy: [{ employeeId: 'asc' }, { dayOfWeek: 'asc' }, { startTime: 'asc' }],
    })

    return NextResponse.json({ availability })
  } catch (err) {
    return handleApiError(err, 'staff-availability GET')
  }
}

// POST — kreiraj / posodobi razpoložljivost
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    // FIX R85-4b MEDIUM: tenant scope — model NIMA locationId stolpca, zato žig
    // ne obstaja; namesto tega lastniški guard nad employeeId (tuji zaposleni → 404).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URLSearchParams(), {
      endpoint: 'POST /api/staff-availability',
    })
    if ('error' in scope) return scope.error

    const body = await req.json().catch(() => ({}))

    // Podpira batch (array) ali single
    const items = Array.isArray(body) ? body : [body]
    const validated = z.array(createSchema).parse(items)

    // R85: ownership guard — vsi zaposleni v batchu morajo ležati v scope-u
    // (izpeljano prek Employee.locationId; ena poizvedba za celoten batch).
    // Nepoznan/tuj/legacy-NULL zaposleni za lokacijsko vezanega admina → 404.
    const requestedIds = [...new Set(validated.map((item) => item.employeeId))]
    const inScope = await db.employee.findMany({
      where: {
        id: { in: requestedIds },
        ...(scope.locationId ? { locationId: scope.locationId } : {}),
      },
      select: { id: true },
    })
    const okIds = new Set(inScope.map((e) => e.id))
    const foreignId = requestedIds.find((eid) => !okIds.has(eid))
    if (foreignId) return notInScopeResponse('Zaposleni')

    const results: Array<unknown> = []
    for (const item of validated) {
      const created = await db.staffAvailability.upsert({
        where: {
          employeeId_dayOfWeek_startTime_endTime: {
            employeeId: item.employeeId,
            dayOfWeek: item.dayOfWeek,
            startTime: item.startTime,
            endTime: item.endTime,
          },
        },
        create: {
          employeeId: item.employeeId,
          dayOfWeek: item.dayOfWeek,
          startTime: item.startTime,
          endTime: item.endTime,
          isPreferred: item.isPreferred,
          notes: item.notes,
        },
        update: { isPreferred: item.isPreferred, notes: item.notes },
      })
      results.push(created)
    }

    return NextResponse.json({ success: true, count: results.length, availability: results })
  } catch (err) {
    return handleApiError(err, 'staff-availability POST')
  }
}

// DELETE — izbriši posamezen vnos
export async function DELETE(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    // FIX R85-4b MEDIUM: cross-tenant write guard — StaffAvailability NIMA
    // locationId, scope se izpelje prek employee.locationId. Prej je
    // delete({ where: { id } }) izbrisal TUJ vnos po ugibanju id-ja.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'DELETE /api/staff-availability',
    })
    if ('error' in scope) return scope.error

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id je obvezen' }, { status: 400 })

    const row = await db.staffAvailability.findUnique({
      where: { id },
      select: { id: true, employee: { select: { locationId: true } } },
    })
    if (!row || !isWithinScope(scope.locationId, row.employee.locationId)) {
      return notInScopeResponse('Vnos razpoložljivosti')
    }

    await db.staffAvailability.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    return handleApiError(err, 'staff-availability DELETE')
  }
}
