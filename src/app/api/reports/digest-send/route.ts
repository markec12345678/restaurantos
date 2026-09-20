
// ============================================
// POST /api/reports/digest-send — Ročno pošiljanje dnevnega menedžerskega povzetka
// ============================================
// Task 22: zapre admin zanko "konfiguriraj → testiraj → predogled → pošlji".
// Admin lahko digest pošlje TAKOJ, ne čaka na cron ob 2:00 UTC.
//
// Idempotentnost (brez duplikatov s cronom):
//   1. ensureDailySummaryLog(target) — ustvari per-recipient pending loge
//      (sam preskoči, če pending/sent že obstaja → cron ne bo poslal dvakrat)
//   2. Pošlje SAMO logom z statusom 'pending' ali 'failed' (failed = retry
//      po popravljenem SMTP), 'sent' logom ne pošilja ponovno
//   3. Uspešnost zapiše nazaj v log (sent/failed) — enako kot process route
//
// Auth: admin. Rate limit: AUTHENTICATED_LIMIT.
// Body: { date?: 'YYYY-MM-DD' } (privzeto včeraj — ista semantika kot cron).
// ============================================

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import {
  fetchDailyDigestData,
  sendDailyDigestEmail,
  ensureDailySummaryLog,
} from '@/lib/email/daily-digest'

export const dynamic = 'force-dynamic'

// FIX R84-1 MEDIUM: digest pošiljanje je platform-level operacija (globalni
// prejemniki + vsebina vseh lokacij). Kanonični gate = mirror /api/receipts/rebuild.
function platformAdminGate(authResult: { session: { role: string; locationId?: string | null } | null }): NextResponse | null {
  const session = authResult.session
  const isPlatformAdmin = !!session && ['admin', 'super_admin'].includes(session.role) && !session.locationId
  if (isPlatformAdmin) return null
  return NextResponse.json(
    { error: 'Dnevni povzetek je platformsko poročilo — pošiljanje dovoljeno samo platformnemu administratorju.' },
    { status: 403 },
  )
}

const sendSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum mora biti v formatu YYYY-MM-DD')
    .optional(),
})

/** Včeraj (server-local, konsistentno z digest/cron semantiko). */
function yesterday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
}

function dayBounds(date: Date) {
  return {
    gte: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0),
    lte: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59),
  }
}

export async function POST(req: Request) {
  try {
    const rl = await checkRateLimitAsync('digest-send', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Preveč zahtevkov' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } }
      )
    }

    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error
    const platformGate = platformAdminGate(authResult)
    if (platformGate) return platformGate

    let body: unknown = {}
    try {
      body = await req.json()
    } catch {
      // prazno telo je dovoljeno (privzeto včeraj)
    }
    const { data: parsed, error: validationError } = sendSchema.safeParse(body)
    if (validationError) {
      return NextResponse.json({ error: validationError.issues[0]?.message }, { status: 400 })
    }

    // YYYY-MM-DD → lokalni Date (opoldne — deterministične dnevne meje)
    let target = yesterday()
    if (parsed.date) {
      const [y, m, d] = parsed.date.split('-').map(Number)
      target = new Date(y, m - 1, d, 12, 0, 0)
    }

    // 1) Idempotentno zagotovi loge (non-throwing; razlog opisuje, če je onemogočeno)
    const ensured = await ensureDailySummaryLog(target)
    if (!ensured.success) {
      return NextResponse.json(
        { error: ensured.reason || 'Pošiljanje ni mogoče' },
        { status: 400 }
      )
    }

    // 2) Zberi loge za ta tip+datum — pošiljamo SAMO pending/failed ('sent' = že dostavljeno)
    const bounds = dayBounds(target)
    const logs = await db.scheduledEmailLog.findMany({
      where: {
        reportType: 'daily_summary',
        reportDate: bounds,
      },
      orderBy: { createdAt: 'asc' },
    })

    const targets = logs.filter(l => l.status === 'pending' || l.status === 'failed')

    if (targets.length === 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'Dnevni povzetek za ta dan je že bil poslan vsem prejemnikom',
        date: ensured.reportDate,
        sent: 0,
        failed: 0,
        results: [],
      })
    }

    // 3) Zbirka podatkov ENKRAT (isti datum za vse prejemnike)
    const data = await fetchDailyDigestData(target)

    // 4) Pošlji per-recipient + zapiši status nazaj (enako kot process route)
    const results: Array<{ to: string; ok: boolean; error?: string }> = []
    let sent = 0
    let failed = 0

    for (const log of targets) {
      const sendResult = await sendDailyDigestEmail(log.recipient, data)
      if (sendResult.success) {
        sent++
        results.push({ to: log.recipient, ok: true })
        await db.scheduledEmailLog.update({
          where: { id: log.id },
          data: { status: 'sent', sentAt: new Date() },
        })
      } else {
        failed++
        results.push({ to: log.recipient, ok: false, error: sendResult.error })
        await db.scheduledEmailLog.update({
          where: { id: log.id },
          data: { status: 'failed', errorMessage: sendResult.error || 'Neznana napaka' },
        })
      }
    }

    return NextResponse.json({
      success: sent > 0,
      skipped: false,
      date: ensured.reportDate,
      sent,
      failed,
      results,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/reports/digest-send', 'Napaka pri pošiljanju dnevnega povzetka')
  }
}
