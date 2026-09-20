// ============================================
// POST /api/ai/staff-scheduler — AI generiranje razporeda
// ============================================
// Določi optimalno osebje za naslednji teden/tedne glede na:
//   - Zgodovinski promet (forecast)
//   - Razpoložljivost zaposlenih
//   - Delovne omejitve (EU/SI labor law)
//
// Po raziskavi 2025: 10-15% zmanjšanje stroškov dela.
//
// Request body:
//   { startDate: "2026-09-01", days: 7, locationId?: string, dryRun?: boolean, apply?: boolean }
//
// Response: SchedulerResult (generated, coverage, insights)
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationId, resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
// odstranjen prazen import (runda 12 lint cleanup)
import { handleApiError } from '@/lib/api-utils'
import { z } from 'zod'
import { generateSchedule } from '@/lib/scheduler/generate'

export const dynamic = 'force-dynamic'

const schedulerSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum mora biti YYYY-MM-DD'),
  days: z.number().int().min(1).max(14).default(7),
  locationId: z.string().max(100).optional(),
  dryRun: z.boolean().default(true),
  apply: z.boolean().default(false),
})

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    // R86-2c2 (M2 klasa): resolver gate PRED body parsanjem — prej je raw
    // `sessionLoc ?? (isAdmin ? input.locationId : undefined)` non-admin sejo z
    // NULL lokacijo poslal v generateSchedule GLOBALNO (undefined locationId =
    // branje StaffAvailability/TimeOffRequest VSEH tenantov + z apply=true
    // zapis razporedov čez vse lokacije). Zdaj: 403 fail-closed; super-admin
    // sme body kandidat (ali globalni pogled).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'POST /api/ai/staff-scheduler',
    })
    if ('error' in scope) return scope.error

    const body = await req.json().catch(() => ({}))
    const input = schedulerSchema.parse(body)

    // FIX P0-C2: Override body locationId z avtoritativnim session.locationId za regular user
    const effectiveLocationId = scope.locationId ?? input.locationId ?? undefined

    const result = await generateSchedule({ ...input, locationId: effectiveLocationId })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (err) {
    return handleApiError(err, 'AI staff scheduler')
  }
}

// GET — vrne trenutno konfiguracijo / metapodatke
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0]
    const days = Math.min(parseInt(searchParams.get('days') || '7', 10), 14)

    // FIX P0-C2: Centralni tenant scope resolver — fail-closed, no ?locationId bypass
    const scope = resolveTenantLocationId(authResult.session, searchParams, {
      endpoint: 'GET /api/ai/staff-scheduler',
    })
    if (!scope.ok) return scope.error

    const result = await generateSchedule({ startDate, days, locationId: scope.locationId ?? undefined, dryRun: true })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (err) {
    return handleApiError(err, 'AI staff scheduler GET')
  }
}
