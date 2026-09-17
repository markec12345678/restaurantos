// ============================================
// GET/POST /api/cis/retry-pending — Batch ponovna oddaja pending računov (runda 30)
// ============================================
// FINA lahko oddajo zavrne (b001 'Račun već poslan', transport down, P12
// manjkal ob plačilu …) — ti računi ostanejo cisStatus='pending' (indeks na
// stolpcu, runda 29) in jih NI treba ročno loviti. Batch endpoint jih poišče
// in poskusi znova; submitReceiptToCis je idempotenten + non-throwing.
//
//   GET  → { ok, pendingCount, failedCount } — badge števec za CisTab UI
//   POST { limit?: 1..25 } → sekvencni retry najstarejših pending/failed
//
// Sekvencno (NE vzporedno): Neon pooler connection_limit=1 + FINA rate —
// 25 klicev zapored je še vedno hitro (echo ~1–3 s, oddaja ~2–5 s).
// Auth: admin; rate limit: CIS_BATCH_RETRY_LIMIT (10 / 5 min, deljeno vedro).
// 200 VEDNO (non-throwing) — posamezen fail ne prekine batcha.
// ============================================

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { checkRateLimitAsync, getClientIp, CIS_BATCH_RETRY_LIMIT } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { db } from '@/lib/db'
import { submitReceiptToCis, type CisSubmissionOutcome } from '@/lib/cis'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // batch do 25 × ~2 s — Vercel max za API route

const DEFAULT_BATCH = 10
const MAX_BATCH = 25

const retrySchema = z.object({
  limit: z
    .number()
    .int('limit mora biti celo število')
    .min(1, 'limit mora biti vsaj 1')
    .max(MAX_BATCH, `limit je največ ${MAX_BATCH}`)
    .optional(),
})

/** Skupni izid batcha (za UI toast + log). */
export interface RetryBatchSummary {
  attempted: number
  submitted: number
  skipped: number
  stillPending: number
  errors: number
  jirs: string[]
}

interface RetryItemResult {
  receiptId: string
  receiptNumber?: string
  ok: boolean
  skipped?: boolean
  reason?: string
  cisStatus?: string
  jir?: string
  error?: string
}

async function guard(req: Request): Promise<Response | null> {
  const rl = await checkRateLimitAsync('cis-retry-pending', getClientIp(req), CIS_BATCH_RETRY_LIMIT)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Preveč zahtevkov' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 300000) / 1000)) } }
    )
  }
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error
  return null
}

/** GET — števci za UI badge (pending + failed). */
export async function GET(req: Request) {
  try {
    const denied = await guard(req)
    if (denied) return denied

    const [pendingCount, failedCount] = await Promise.all([
      db.receipt.count({ where: { cisStatus: 'pending' } }),
      db.receipt.count({ where: { cisStatus: 'failed' } }),
    ])

    return NextResponse.json({ ok: true, pendingCount, failedCount })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/cis/retry-pending', 'Napaka pri branju CIS števcev')
  }
}

/** POST — batch ponovna oddaja (FIFO po createdAt, max 25). */
export async function POST(req: Request) {
  try {
    const denied = await guard(req)
    if (denied) return denied

    // Telo je OPCIJSKO (prazen POST = privzeti batch)
    let raw: unknown = {}
    try {
      raw = await req.json()
    } catch {
      raw = {}
    }
    const parsed = retrySchema.safeParse(raw ?? {})
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? `limit mora biti 1–${MAX_BATCH}` },
        { status: 400 }
      )
    }
    const limit = parsed.data.limit ?? DEFAULT_BATCH

    const pending = await db.receipt.findMany({
      where: { cisStatus: { in: ['pending', 'failed'] } },
      select: { id: true, receiptNumber: true },
      orderBy: { createdAt: 'asc' }, // FIFO — najstarejši neoddani najprej
      take: limit,
    })

    const summary: RetryBatchSummary = {
      attempted: pending.length,
      submitted: 0,
      skipped: 0,
      stillPending: 0,
      errors: 0,
      jirs: [],
    }
    const results: RetryItemResult[] = []

    for (const r of pending) {
      try {
        const outcome: CisSubmissionOutcome = await submitReceiptToCis(r.id)
        if (outcome.skipped) {
          summary.skipped++
        } else if (outcome.ok && outcome.jir) {
          summary.submitted++
          summary.jirs.push(outcome.jir)
        } else {
          summary.stillPending++
        }
        results.push({
          receiptId: r.id,
          receiptNumber: r.receiptNumber,
          ok: outcome.ok,
          skipped: outcome.skipped,
          reason: outcome.reason,
          cisStatus: outcome.cisStatus,
          jir: outcome.jir,
        })
      } catch (error: unknown) {
        // submitReceiptToCis je non-throwing — tukaj je samo katastrofa pri
        // db.update; batch vseeno gre naprej (en pokvarjen vnos ne blokira).
        summary.errors++
        results.push({
          receiptId: r.id,
          receiptNumber: r.receiptNumber,
          ok: false,
          error: error instanceof Error ? error.message.substring(0, 200) : 'Neznana napaka',
        })
      }
    }

    logger.info(
      'CIS',
      `retry-pending: ${summary.attempted} poskusov → ${summary.submitted} JIR, ` +
        `${summary.stillPending} pending, ${summary.skipped} skip, ${summary.errors} napak`
    )

    return NextResponse.json({ ok: true, ...summary, results })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/cis/retry-pending', 'Napaka pri ponovni oddaji računov na CIS')
  }
}
