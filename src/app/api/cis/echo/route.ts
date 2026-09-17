// ============================================
// /api/cis/echo — CIS povezljivost (echo) + batch ponovna oddaja pending računov
// ============================================
// Task 23: app-level živo preverjanje CIS povezljivosti (zrcali FURS echo iz
// GET /api/furs). Izvede SOAP EchoRequest round-trip na test/prod endpoint —
// brez certifikata (CIS podpisuje XML Body, ne TLS — glej src/lib/cis/echo.ts).
//
// R31 FOLD: batch retry (prej /api/cis/retry-pending, runda 30) je zložen sem,
// ker Vercel Hobby omeji število serverless funkcij na deployment — vsak NOVI
// route.ts poveča števec in deployment pade (exceeded_serverless_functions_...
// per_deployment). Zloženo na obstoječ file = 0 novih funkcij.
//
//   GET  ?resource=pending            → { ok, pendingCount, failedCount } badge
//   GET  ?environment=test|production → echo povezljivost (privzeto test)
//   POST { action:'retry-pending', limit?: 1..25 } → sekvencni retry
//        najstarejših pending/failed računov (FIFO createdAt)
//
// Sekvencno (NE vzporedno): Neon pooler connection_limit=1 + FINA rate —
// 25 klicev zapored je še vedno hitro (echo ~1–3 s, oddaja ~2–5 s).
// Auth: admin. Rate limit: AUTHENTICATED_LIMIT (echo) / CIS_BATCH_RETRY_LIMIT
// (retry, 10 / 5 min, deljeno vedro). Retry: 200 VEDNO (non-throwing).
// ============================================

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import {
  checkRateLimitAsync,
  getClientIp,
  AUTHENTICATED_LIMIT,
  CIS_BATCH_RETRY_LIMIT,
} from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { db } from '@/lib/db'
import { checkCisConnectivity, submitReceiptToCis, type CisSubmissionOutcome } from '@/lib/cis'
import type { CisEnvironment } from '@/lib/cis'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // batch do 25 × ~2 s — Vercel max za API route

const echoQuerySchema = z.object({
  environment: z.enum(['test', 'production']).optional(),
})

// ─── Batch retry (runda 30, r31 fold) ───

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

async function retryGuard(req: Request): Promise<Response | null> {
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

/** GET ?resource=pending — števci za UI badge (pending + failed). */
async function retryStats(): Promise<Response> {
  const [pendingCount, failedCount] = await Promise.all([
    db.receipt.count({ where: { cisStatus: 'pending' } }),
    db.receipt.count({ where: { cisStatus: 'failed' } }),
  ])
  return NextResponse.json({ ok: true, pendingCount, failedCount })
}

/** POST { action:'retry-pending' } — batch ponovna oddaja (FIFO, max 25). */
async function retryPending(req: Request, raw: unknown): Promise<Response> {
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
}

// ─── Handlers ───

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)

    if (url.searchParams.get('resource') === 'pending') {
      const denied = await retryGuard(req)
      if (denied) return denied
      return await retryStats()
    }

    // Privzeto: echo povezljivost (Task 23)
    const rl = await checkRateLimitAsync('cis-echo', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Preveč zahtevkov' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } }
      )
    }

    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { data: parsed, error: validationError } = echoQuerySchema.safeParse({
      environment: url.searchParams.get('environment') || undefined,
    })
    if (validationError) {
      return NextResponse.json({ error: validationError.issues[0]?.message }, { status: 400 })
    }

    const environment: CisEnvironment = parsed.environment ?? 'test'
    const connectivity = await checkCisConnectivity(environment)

    return NextResponse.json({
      environment,
      ...connectivity,
      checkedAt: new Date().toISOString(),
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/cis/echo', 'Napaka pri preverjanju CIS povezljivosti')
  }
}

export async function POST(req: Request) {
  try {
    // Guard PRED parse (401/429 imajo prednost pred 400 — zrcali retry-pending)
    const denied = await retryGuard(req)
    if (denied) return denied

    // Telo je OPCIJSKO pri retry (prazen POST z action v query) — beri tolerantno
    let raw: unknown = {}
    try {
      raw = await req.json()
    } catch {
      raw = {}
    }

    const action =
      (raw !== null && typeof raw === 'object' && 'action' in raw
        ? (raw as { action?: unknown }).action
        : undefined) ?? new URL(req.url).searchParams.get('action')

    // action je opcijsko — POST na echo pomeni retry (ni drugega POST obnašanja);
    // izrecen NEZNAN action → 400 (tipografija se ne utaji kot batch oddaja)
    if (action !== undefined && action !== null && action !== 'retry-pending') {
      return NextResponse.json(
        { error: "Nepoznan action — podpira se samo 'retry-pending'" },
        { status: 400 }
      )
    }

    return await retryPending(req, raw)
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/cis/echo', 'Napaka pri ponovni oddaji računov na CIS')
  }
}
