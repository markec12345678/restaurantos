// ============================================
// CRON WORKER — Outbox procesiranje
// ============================================
// Vercel Cron pokliče ta endpoint DNEVNO ob 03:00 UTC.
// Konfigurirano v vercel.json (avtoritativni vir urnikov):
//   { "crons": [{ "path": "/api/cron/outbox", "schedule": "0 3 * * *" }] }
//
// Varnost: CRON_SECRET v headerju preprečuje zlorabe.
// ============================================
import { NextResponse } from 'next/server'
import { processOutboxBatch, cleanupOldSentEvents, getOutboxStats } from '@/lib/outbox'
import { processBirthdayBatch, processWinbackBatch, DEFAULT_CONFIG } from '@/lib/loyalty-automation'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Vercel: max 60s za cron job

export async function GET(req: Request) {
  return POST(req)
}

export async function POST(req: Request) {
  try {
    // 1. Avtenticiraj s CRON_SECRET (Vercel Cron pošlje v headerju)
    // FIX R82-F (fail-open bug): prej `if (expectedAuth && ...)` — brez
    // nastavljenega CRON_SECRET je bil guard POPOLNOMA PRESKOČEN → anonimni
    // sprožilec SMS batchov/outboxa čez vse tenantе! Zdaj fail-closed.
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const expectedAuth = cronSecret ? `Bearer ${cronSecret}` : null

    if (!(expectedAuth && authHeader === expectedAuth)) {
      // Če ni nastavljen CRON_SECRET, dovolimo samo z admin perm
      const { requireAuth } = await import('@/lib/auth-middleware')
      const authResult = await requireAuth(req, { permission: 'admin' })
      if (authResult.error) {
        logger.warn('Cron', `Unauthorized cron call from ${req.headers.get('x-forwarded-for') || 'unknown'}`)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const startTime = Date.now()
    const { searchParams } = new URL(req.url)
    const job = searchParams.get('job') || 'all'

    const results: Record<string, unknown> = {}

    // 2. Procesiraj outbox (vedno)
    if (job === 'all' || job === 'outbox') {
      const outboxResult = await processOutboxBatch(25)
      results.outbox = outboxResult
      logger.info('Cron', `Outbox processed: ${outboxResult.succeeded} succeeded, ${outboxResult.failed} failed`)
    }

    // 3. Cleanup starih sent events (dnevno)
    if (job === 'all' || job === 'cleanup') {
      const deleted = await cleanupOldSentEvents(30)
      results.cleanup = { deletedOlderThanDays: 30, deleted }
      logger.info('Cron', `Cleaned up ${deleted} old sent events`)
    }

    // 4. Loyalty automation — birthday batch (dnevno)
    // R86-4: batch funkcije zahtevata locationId — cron je PLATFORMSKI globalni
    // worker (CRON_SECRET fail-closed, R82-F) → ekspliciten null = vse lokacije.
    if (job === 'all' || job === 'birthday') {
      const birthdayResult = await processBirthdayBatch(DEFAULT_CONFIG, null)
      results.birthday = birthdayResult
      // R143-b: skippedNoBirthday = računi brez ujemajočega Guest rojstnega
      // dneva (soft-join) — brez PII, samo števec (kontrakt (d))
      logger.info('Cron', `Birthday batch: ${birthdayResult.sent} SMS sent, ${birthdayResult.pointsAwarded} pts awarded, ${birthdayResult.skippedNoBirthday} skipped (no birthday)`)
    }

    // 5. Loyalty automation — winback (tedensko)
    if (job === 'all' || job === 'winback') {
      const winbackResult = await processWinbackBatch(DEFAULT_CONFIG, null)
      results.winback = winbackResult
      logger.info('Cron', `Winback batch: ${winbackResult.sent} SMS sent, ${winbackResult.pointsAwarded} pts awarded`)
    }

    // 6. Statistika za log
    const stats = await getOutboxStats()
    results.stats = stats

    const duration = Date.now() - startTime
    logger.info('Cron', `Completed in ${duration}ms`)

    return NextResponse.json({
      success: true,
      duration,
      results,
    })
  } catch (err) {
    logger.error('Cron', `Worker failed: ${err instanceof Error ? err.message : String(err)}`)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
