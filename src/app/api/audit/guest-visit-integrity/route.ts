// ============================================
// GET /api/audit/guest-visit-integrity — Verify GuestVisit hash chain
//
// Auditni endpoint (admin-only) ki preveri integriteto GuestVisit hash verige.
// Vrne prvi vnos kjer je veriga prelomljena (ali { ok: true } če je nepoškodovana).
//
// EU 852/2004: HACCP evidence mora biti tamper-evident — ta endpoint omogoča
// redne integrity checke (npr. dnevni cron) da zazna manipulacijo podatkov.
//
// Issue #35 (PR #59): audit endpoint za GuestVisit hash chain
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { verifyGuestVisitChainIntegrity } from '@/lib/guest-visit-chain'
import { createAuditLog } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const brokenEntry = await verifyGuestVisitChainIntegrity()

    // Audit log da je bil integrity check izveden
    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'GUEST_VISIT_INTEGRITY_CHECK',
      entityType: 'GuestVisit',
      details: {
        ok: brokenEntry === null,
        brokenVisitId: brokenEntry?.id || null,
        brokenEmployeeName: brokenEntry?.employeeName || null,
      },
    })

    if (brokenEntry) {
      return NextResponse.json({
        ok: false,
        brokenEntry,
        message: `Prelomljena hash veriga pri vnosu ${brokenEntry.id} (employeeName=${brokenEntry.employeeName})`,
      })
    }

    return NextResponse.json({
      ok: true,
      message: 'GuestVisit hash veriga je nepoškodovana',
    })
  } catch (error: unknown) {
    return handleApiError(
      error,
      'GET /api/audit/guest-visit-integrity',
      'Napaka pri preverjanju integritete GuestVisit verige',
    )
  }
}
