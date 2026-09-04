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
import { checkRateLimit, getClientIp, AI_ASSISTANT_LIMIT } from '@/lib/rate-limit'
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

    const body = await req.json().catch(() => ({}))
    const input = schedulerSchema.parse(body)

    const result = await generateSchedule(input)

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
    const locationId = searchParams.get('locationId') || undefined

    const result = await generateSchedule({ startDate, days, locationId, dryRun: true })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (err) {
    return handleApiError(err, 'AI staff scheduler GET')
  }
}
