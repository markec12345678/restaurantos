// ============================================
// HEALTH CHECK — /api/health
// ============================================
// Simple health endpoint za monitoring (Vercel, UptimeRobot, k6).
// Preverja:
//   1. Aplikacija odgovarja (process alive)
//   2. Povezava do DB (optional — počasno)
//
// Varnost: JAVNI endpoint (brez auth) — uporablja se za uptime monitoring.
// Ne vrača občutljivih podatkov.
//
// Query params:
//   ?deep=true — preveri tudi DB povezavo (počasnejše, ~500ms)
//   ?simple=true — samo 200 OK (za load balancer)
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Cache health status za 10s — prepreči preobremenitev DB
let cachedHealth: { status: string; timestamp: number; dbOk?: boolean } | null = null
const CACHE_TTL_MS = 10_000

export async function GET(req: Request) {
  const url = new URL(req.url)
  const simple = url.searchParams.get('simple') === 'true'
  const deep = url.searchParams.get('deep') === 'true'

  // Simple mode — samo 200 OK (za load balancer / Vercel uptime)
  if (simple) {
    return NextResponse.json({ status: 'ok' }, { status: 200 })
  }

  // Preveri cache (10s TTL)
  const now = Date.now()
  if (cachedHealth && (now - cachedHealth.timestamp) < CACHE_TTL_MS && !deep) {
    return NextResponse.json({
      status: cachedHealth.status,
      timestamp: new Date(cachedHealth.timestamp).toISOString(),
      db: cachedHealth.dbOk ? 'ok' : 'error',
      cached: true,
    })
  }

  // Deep mode — preveri DB povezavo
  let dbOk = true
  let dbError: string | undefined
  if (deep) {
    try {
      // Preprosta query ki preveri ali DB odgovarja
      await db.$queryRaw`SELECT 1`
    } catch (err) {
      dbOk = false
      dbError = err instanceof Error ? err.message : String(err)
      logger.error('HEALTH', 'DB health check failed:', err)
    }
  }

  const status = dbOk ? 'ok' : 'degraded'
  const response = {
    status,
    timestamp: new Date().toISOString(),
    db: dbOk ? 'ok' : 'error',
    ...(dbError ? { dbError: dbError.substring(0, 200) } : {}),
    uptime: process.uptime ? `${Math.floor(process.uptime())}s` : undefined,
    environment: process.env.NODE_ENV || 'development',
  }

  // Update cache (samo če je DB OK — ne cachiraj errorjev)
  if (dbOk) {
    cachedHealth = { status, timestamp: now, dbOk }
  }

  // 200 tudi če je degraded (samo app še vedno teče)
  // 503 samo če bi app popolnoma crknil (kar ne moremo dosegiti — Vercel bi vrnil 500)
  return NextResponse.json(response, { status: 200 })
}
