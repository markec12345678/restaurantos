// ============================================
// GET /api/system/db-health — Database configuration health check
//
// ISSUE #40: Admin diagnostic endpoint za Prisma provider mismatch.
// Preveri ali DATABASE_URL ustreza schema.provider (postgresql).
//
// Vrne:
//   - valid: ali je konfiguracija pravilna
//   - usesPglite: ali uporablja embedded PostgreSQL (dev mode)
//   - usesExternalPostgres: ali uporablja zunanji PostgreSQL (prod)
//   - maskedDatabaseUrl: varna verzija URL (brez gesla)
//   - error: opis napake (če ni veljavno)
//   - recommendations: predlogi za admin
//
// RBAC: admin only
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { validateDatabaseConfig } from '@/lib/db-config-validator'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const result = validateDatabaseConfig()

    // Vrni 503 če ni veljavno (health check fail)
    const status = result.valid ? 200 : 503

    return NextResponse.json(result, { status })
  } catch (error: unknown) {
    return handleApiError(
      error,
      'GET /api/system/db-health',
      'Napaka pri preverjanju DB konfiguracije',
    )
  }
}
