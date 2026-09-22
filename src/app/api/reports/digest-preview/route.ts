
// ============================================
// GET /api/reports/digest-preview — Predogled dnevnega menedžerskega povzetka
// ============================================
// Task 21: Admin v Email zavihku lahko PRED ogledom poglede, kako bo izgledal
// dnevni digest email (isti HTML kot bo šel prek crona ob 2:00 UTC).
//
// Reuse: fetchDailyDigestData + buildDailyDigestHtml iz /lib/email/daily-digest
// (identična semantika kot produkcija — paymentStatus='paid', server-local dni).
//
// Auth: admin. Rate limit: AUTHENTICATED_LIMIT.
// Query: ?date=YYYY-MM-DD (neobvezno; privzeto včeraj).
// Odgovor: { data: DailyDigestData, html: string }
// ============================================

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { fetchDailyDigestData, buildDailyDigestHtml } from '@/lib/email/daily-digest'

export const dynamic = 'force-dynamic'

// FIX R84-1 MEDIUM: digest je platform-level poročilo (globalni prejemniki iz
// RestaurantSettings + združeni prihodki VSEH lokacij). Lokacijski admin ga
// ne sme brati/sprožiti. Kanonični gate = mirror /api/receipts/rebuild (R82-B).
function platformAdminGate(authResult: { session: { role: string; locationId?: string | null } | null }): NextResponse | null {
  const session = authResult.session
  const isPlatformAdmin = !!session && ['admin', 'super_admin'].includes(session.role) && !session.locationId
  if (isPlatformAdmin) return null
  return NextResponse.json(
    { error: 'Dnevni povzetek je platformsko poročilo — dostop ima samo platformni administrator.' },
    { status: 403 },
  )
}

const dateQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum mora biti v formatu YYYY-MM-DD')
    .optional(),
})

/** Včeraj (server-local, konsistentno z digest semantiko). */
function yesterday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
}

export async function GET(req: Request) {
  try {
    const rl = await checkRateLimitAsync('digest-preview', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) {
      return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')
    }

    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error
    const platformGate = platformAdminGate(authResult)
    if (platformGate) return platformGate

    const url = new URL(req.url)
    const { data: parsed, error: validationError } = dateQuerySchema.safeParse({
      date: url.searchParams.get('date') || undefined,
    })
    if (validationError) {
      return NextResponse.json({ error: validationError.issues[0]?.message }, { status: 400 })
    }

    // YYYY-MM-DD → lokalni Date (opoldne, da so bounds deterministični)
    let target = yesterday()
    if (parsed.date) {
      const [y, m, d] = parsed.date.split('-').map(Number)
      target = new Date(y, m - 1, d, 12, 0, 0)
    }

    const data = await fetchDailyDigestData(target)
    const html = buildDailyDigestHtml(data)

    return NextResponse.json({ data, html })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/reports/digest-preview', 'Napaka pri generiranju predogleda')
  }
}
