// ============================================
// CRON WORKER — Outbox procesiranje
// ============================================
// Vercel Cron pokliče ta endpoint vsakih 5 minut.
// Konfigurirano v vercel.json:
//   { "crons": [{ "path": "/api/cron/outbox", "schedule": "*/5 * * * *" }] }
//
// Varnost: CRON_SECRET v headerju preprečuje zlorabe.
// ============================================
import { NextResponse } from 'next/server'
import { processOutboxBatch, cleanupOldSentEvents, getOutboxStats } from '@/lib/outbox'
import { processBirthdayBatch, processWinbackBatch } from '@/lib/loyalty-automation'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Vercel: max 60s za cron job

export async function GET(req: Request) {
  return POST(req)
}

export async function POST(req: Request) {
  try {
    // 1. Avtenticiraj s CRON_SECRET (Vercel Cron pošlje v headerju)
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const expectedAuth = cronSecret ? `Bearer ${cronSecret}` : null

    if (expectedAuth && authHeader !== expectedAuth) {
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
    if (job === 'all' || job === 'birthday') {
      const birthdayResult = await processBirthdayBatch()
      results.birthday = birthdayResult
      logger.info('Cron', `Birthday batch: ${birthdayResult.sent} SMS sent, ${birthdayResult.pointsAwarded} pts awarded`)
    }

    // 5. Loyalty automation — winback (tedensko)
    if (job === 'all' || job === 'winback') {
      const winbackResult = await processWinbackBatch()
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
