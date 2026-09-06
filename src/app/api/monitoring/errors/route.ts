// ============================================
// POST /api/monitoring/errors — Client-side error reporting
// ============================================
// Receives error reports from client-side handler.
// Logs to Vercel built-in logging (visible in Vercel dashboard → Logs).
// Optionally forwards to Sentry ingest API when SENTRY_DSN is set.
//
// FIX P5 (audit 2026-09-06):
//   1. Rate limiting — 10 reports/min/IP (preprečuje log injection DoS)
//   2. Input validation z Zod — preprečuje injection poljubnih struktur
//   3. Size limits — message max 2000 chars, stack max 5000 chars
//   4. Log sanitization — strip newline characters iz message da preprečimo
//      log injection (napadalec bi lahko vstavil \n da simulira nov log vnos)
// ============================================
import { logger } from "@/lib/logger"
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimitAsync, getClientIp, MONITORING_LIMIT } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// FIX P5: Zod schema za validacijo inputa
const errorReportSchema = z.object({
  message: z.string().max(2000, 'Message presega 2000 znakov').default('No message'),
  stack: z.string().max(5000, 'Stack presega 5000 znakov').optional(),
  url: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
  timestamp: z.string().max(50).default(() => new Date().toISOString()),
  level: z.enum(['error', 'warn', 'info']).default('error'),
  tags: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
})

/**
 * Sanitiziraj string za varno logiranje — odstrani newline karakterje
 * da preprečimo log injection (napadalec bi lahko vstavil \n da simulira
 * nov log vnos in potem lažira sistemsko sporočilo).
 */
function sanitizeForLog(str: string): string {
  return str.replace(/[\n\r]/g, '\\n').slice(0, 2000)
}

export async function POST(req: Request) {
  try {
    // FIX P5: Rate limiting — prepreči spam fake error reports
    const clientIp = getClientIp(req)
    const rl = await checkRateLimitAsync('monitoring-errors', clientIp, MONITORING_LIMIT)
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: 'Rate limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } }
      )
    }

    // FIX P5: Parse + validate z Zod
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
    }

    const parseResult = errorReportSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid error report format' },
        { status: 400 }
      )
    }

    const { message, stack, url, userAgent, timestamp, level, tags } = parseResult.data

    // FIX P5: Sanitiziraj vse user-supplied strings pred logiranjem
    const safeMessage = sanitizeForLog(message)
    const safeUrl = url ? sanitizeForLog(url) : ''
    const safeTags = JSON.stringify(tags).slice(0, 500)

    // 1. Log to Vercel built-in logging (always visible in dashboard)
    const logLine = `[${level.toUpperCase()}] ${timestamp} | ${safeMessage} | url=${safeUrl} | tags=${safeTags}`
    if (level === 'error') {
      logger.error("CONSOLE", logLine)
      if (stack) logger.error("CONSOLE", sanitizeForLog(stack))
    } else {
      logger.warn("CONSOLE", logLine)
    }

    // 2. Optionally forward to Sentry ingest API (envelope endpoint)
    // Sentry DSN format: https://<publickey>@o<orgid>.ingest.sentry.io/<projectid>
    const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
    if (dsn) {
      try {
        // Parse DSN to get ingest URL and project ID
        const match = dsn.match(/^https?:\/\/([^@]+)@(.+?)\/(\d+)$/)
        if (match) {
          const [, publicKey, host, projectId] = match
          const ingestUrl = `https://${host}/api/${projectId}/envelope/`

          // Build Sentry envelope (minimal event)
          const eventId = crypto.randomUUID().replace(/-/g, '')
          const event = {
            event_id: eventId,
            timestamp: new Date(timestamp).toISOString(),
            level: level,
            message: safeMessage,
            platform: 'javascript',
            environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
            release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
            request: { url: safeUrl, headers: userAgent ? { 'user-agent': sanitizeForLog(userAgent) } : {} },
            tags: { ...tags, source: 'lightweight-monitor' },
            exception: stack ? [{ type: 'Error', value: safeMessage, stacktrace: { frames: stack.split('\n').slice(0, 20).map((line: string) => ({ filename: sanitizeForLog(line), function: sanitizeForLog(line) })) } }] : undefined,
          }

          const envelope = JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }) + '\n' + JSON.stringify({ type: 'event' }) + '\n' + JSON.stringify(event)

          await fetch(ingestUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Sentry-Auth': `Sentry sentry_key=${publicKey}, sentry_version=7` },
            body: envelope,
          })
        }
      } catch (sentryErr) {
        logger.error("CONSOLE", '[monitoring] Sentry forward failed:', sentryErr instanceof Error ? sentryErr.message : 'unknown')
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error("CONSOLE", '[monitoring] Failed to process error report:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
