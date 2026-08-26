import { logger } from "@/lib/logger"
import { NextResponse } from 'next/server'

// ─── Lightweight Error Monitoring Endpoint ────────────────────
// Receives error reports from client-side handler.
// Logs to Vercel built-in logging (visible in Vercel dashboard → Logs).
// Optionally forwards to Sentry ingest API when SENTRY_DSN is set.
//
// Zero dependencies. Zero build risk. Works immediately.

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { message, stack, url, userAgent, timestamp, level = 'error', tags = {} } = body

    // 1. Log to Vercel built-in logging (always visible in dashboard)
    const logLine = `[${level.toUpperCase()}] ${timestamp} | ${message} | url=${url} | tags=${JSON.stringify(tags)}`
    if (level === 'error') {
      logger.error("CONSOLE", logLine)
      if (stack) logger.error("CONSOLE", stack)
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
            message: message,
            platform: 'javascript',
            environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
            release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
            request: { url, headers: { 'user-agent': userAgent } },
            tags: { ...tags, source: 'lightweight-monitor' },
            exception: stack ? [{ type: 'Error', value: message, stacktrace: { frames: stack.split('\n').map((line: string) => ({ filename: line, function: line })) } }] : undefined,
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
