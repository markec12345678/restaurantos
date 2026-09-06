// ============================================
// GET /api/health — Sistemski health check
// ============================================
// Preverja:
//   1. Database connectivity (Neon PostgreSQL)
//   2. Redis connectivity (če je konfiguriran)
//   3. FURS test mode (če je konfiguriran)
//   4. Sentry DSN (če je konfiguriran)
//   5. Stripe keys (če so konfigurirani)
//
// Vrne 200 če je DB OK (kritično), 503 če DB odpove.
// Ostale komponente so 'optional' — vrnjejo status v JSON.
//
// Uporaba:
//   - Vercel health check: /api/health
//   - Uptime monitoring: /api/health?detailed=true
//   - Status page: /api/health?detailed=true
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

interface HealthCheck {
  name: string
  status: 'ok' | 'error' | 'warning' | 'not_configured'
  latencyMs?: number
  detail?: string
}

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now()
  try {
    await db.$queryRaw`SELECT 1`
    return {
      name: 'database',
      status: 'ok',
      latencyMs: Date.now() - start,
      detail: 'PostgreSQL connected',
    }
  } catch (error) {
    return {
      name: 'database',
      status: 'error',
      latencyMs: Date.now() - start,
      detail: error instanceof Error ? error.message : 'Unknown DB error',
    }
  }
}

async function checkRedis(): Promise<HealthCheck> {
  if (!process.env.REDIS_URL) {
    return {
      name: 'redis',
      status: 'not_configured',
      detail: 'REDIS_URL not set — using MemoryCacheAdapter',
    }
  }
  const start = Date.now()
  try {
    // Lazy-load ioredis
    const { default: Redis } = await import('ioredis')
    const redis = new Redis(process.env.REDIS_URL, {
      connectTimeout: 2000,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    })
    await redis.connect()
    await redis.ping()
    await redis.quit()
    return {
      name: 'redis',
      status: 'ok',
      latencyMs: Date.now() - start,
      detail: 'Redis connected',
    }
  } catch (error) {
    return {
      name: 'redis',
      status: 'error',
      latencyMs: Date.now() - start,
      detail: error instanceof Error ? error.message : 'Redis connection failed',
    }
  }
}

function checkFurs(): HealthCheck {
  const env = process.env.FURS_ENVIRONMENT
  if (!env) {
    return {
      name: 'furs',
      status: 'not_configured',
      detail: 'FURS_ENVIRONMENT not set',
    }
  }
  if (env === 'test') {
    return {
      name: 'furs',
      status: 'ok',
      detail: 'FURS test mode (no certificate required)',
    }
  }
  // Production mode — check if cert is configured
  const hasCert = !!(process.env.FURS_CERT_PATH || process.env.FURS_CERT_BASE64)
  return {
    name: 'furs',
    status: hasCert ? 'ok' : 'warning',
    detail: hasCert
      ? 'FURS production mode with certificate'
      : 'FURS production mode but NO certificate configured',
  }
}

function checkStripe(): HealthCheck {
  const pk = process.env.STRIPE_PUBLISHABLE_KEY
  const sk = process.env.STRIPE_SECRET_KEY
  if (!pk && !sk) {
    return {
      name: 'stripe',
      status: 'not_configured',
      detail: 'Stripe keys not set (cash payments only)',
    }
  }
  const isTest = pk?.startsWith('pk_test_') || sk?.startsWith('sk_test_')
  return {
    name: 'stripe',
    status: 'ok',
    detail: isTest ? 'Stripe test mode' : 'Stripe production mode',
  }
}

function checkSentry(): HealthCheck {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) {
    return {
      name: 'sentry',
      status: 'not_configured',
      detail: 'SENTRY_DSN not set (error monitoring disabled)',
    }
  }
  return {
    name: 'sentry',
    status: 'ok',
    detail: 'Sentry error monitoring enabled',
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const detailed = url.searchParams.get('detailed') === 'true'

  try {
    // ─── Always check database (critical) ──────────────────────
    const dbCheck = await checkDatabase()

    // If DB is down, return 503 immediately (no point checking other services)
    if (dbCheck.status === 'error') {
      return NextResponse.json({
        status: 'error',
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION || '1.0.2',
        database: dbCheck,
      }, { status: 503 })
    }

    // ─── Detailed mode: check all services ────────────────────
    if (detailed) {
      const [redis, furs, stripe, sentry] = await Promise.all([
        checkRedis(),
        Promise.resolve(checkFurs()),
        Promise.resolve(checkStripe()),
        Promise.resolve(checkSentry()),
      ])

      const checks = [dbCheck, redis, furs, stripe, sentry]
      const allOk = checks.every(c => c.status === 'ok' || c.status === 'not_configured')
      const hasWarnings = checks.some(c => c.status === 'warning')

      return NextResponse.json({
        status: allOk ? 'ok' : (hasWarnings ? 'degraded' : 'error'),
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION || '1.0.2',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime ? `${Math.floor(process.uptime())}s` : undefined,
        checks,
      }, { status: allOk ? 200 : (hasWarnings ? 200 : 503) })
    }

    // ─── Simple mode (default) — just DB ──────────────────────
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.2',
      database: 'connected',
    }, { status: 200 })

  } catch (error) {
    logger.error('HEALTH', 'Health check failed:', error)
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.2',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 503 })
  }
}
