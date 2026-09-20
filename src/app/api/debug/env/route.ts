import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

// FIX R86-4 (LOW, information disclosure): debug/env je razkrival DB connection
// podatke (host, db ime, delono URL preview — 30 znakov raw URL vsebuje tudi
// user:pass del!) vsakemu avtenticiranemu 'admin' ROLI — tudi lokacijskemu
// adminu katere koli tenant naročnine. DB konekcija je PLATFORMSKI vir
// (ena instanca, en DATABASE_URL za vse tenantе) → platformAdminGate
// (EXACT mirror /api/reports/digest-send:35-43): samo admin/super_admin BREZ
// locationId. Legitimna uporaba (config debug na platformni ravni) ostane.
function platformAdminGate(authResult: { session: { role: string; locationId?: string | null } | null }): NextResponse | null {
  const session = authResult.session
  const isPlatformAdmin = !!session && ['admin', 'super_admin'].includes(session.role) && !session.locationId
  if (isPlatformAdmin) return null
  return NextResponse.json(
    { error: 'Debug env informacije so platformske — dostop dovoljen samo platformnemu administratorju.' },
    { status: 403 },
  )
}

export async function GET(req: Request) {
  // FIX Code Review: Dodan admin auth — prej je bil brez auth!
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  // FIX R86-4: platform gate — lokacijski admin ni platformski upravljalec
  const gateError = platformAdminGate(authResult)
  if (gateError) return gateError

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''
  const masked = dbUrl.replace(/([^:]+):\/\/([^:]+):([^@]+)@/, '$1://$2:****@')

  return NextResponse.json({
    DATABASE_URL_set: !!process.env.DATABASE_URL,
    POSTGRES_URL_set: !!process.env.POSTGRES_URL,
    // R86-4: preview je zdaj iz MASKIRANEGA URL-ja — prej je bil raw substring(0,30),
    // ki je lahko vseboval uporabniško ime + del gesla. Host/db ostanejo vidni
    // (legitimna config debug uporaba ni pokvarjena).
    DATABASE_URL_preview: masked ? masked.substring(0, 50) + '...' : 'NOT SET',
    FULL_MASKED: masked,
    POSTGRES_HOST: process.env.POSTGRES_HOST || 'NOT SET',
    PGDATABASE: process.env.PGDATABASE || 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
  })
}
