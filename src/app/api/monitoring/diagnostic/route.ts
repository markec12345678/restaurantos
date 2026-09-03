import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

// Diagnostic endpoint — checks if SENTRY_DSN env var is set.
// FIX Code Review: Added auth requirement (admin only)

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
    const authToken = process.env.SENTRY_AUTH_TOKEN

    return NextResponse.json({
      sentry_dsn_configured: !!dsn,
      sentry_dsn_format_valid: dsn ? /^https?:\/\/[^@]+@.+\/\d+$/.test(dsn) : false,
      sentry_dsn_host: dsn ? (dsn.match(/@(.+?)\//)?.[1] || 'unknown') : 'not-set',
      sentry_auth_token_configured: !!authToken,
      monitoring_active: true,
      timestamp: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
