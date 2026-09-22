// =====================================================================
// DELETE /api/settings/webauthn/credentials/[id] — ADMIN brisanje WebAuthn
// device poverilnice (R97-a)
//
// Auth guard: ISTI kot obstoječe settings endpoints — requireAuth(req,
// { permission: 'admin' }).
//
// Scoped delete (ATOMAREN, brez obstoja-oraklja): deleteMany z
// { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) }.
//   - lokacijsko vezan admin: tuja poverilnica = count 0 = ISTI 404 kot
//     neobstoječi id (ni razlikovanja — cross-tenant id ne pove, da obstaja);
//   - super-admin (scope null): deleteMany({ id }) — brez lokacijskega filtra.
// Count 0 → unificiran notInScopeResponse 404; count 1 → { success: true }.
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationIdOrThrow, notInScopeResponse } from '@/lib/tenant-scope'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
// DIRECT import (ne barrel) — hišni kanon 429 oblike (R92-b)
import { rateLimitedResponse } from '@/lib/rate-limit/response'

export const dynamic = 'force-dynamic'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Rate limiting — settings družina (isti bucket kot seznam: ena UI površina).
  const rl = await checkRateLimitAsync('settings-webauthn-credentials', getClientIp(req), AUTHENTICATED_LIMIT)
  if (!rl.allowed) {
    return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')
  }

  // ADMIN guard — isti kot obstoječi settings endpoints.
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error
  const session = authResult.session

  const { id } = await params
  if (typeof id !== 'string' || id.length === 0) {
    return notInScopeResponse('Poverilnica')
  }

  // Tenant scope — lokacijsko vezan admin dobi svojo lokacijo, super-admin null.
  const scope = resolveTenantLocationIdOrThrow(session, null, {
    endpoint: 'DELETE /api/settings/webauthn/credentials/[id]',
  })
  if ('error' in scope) return scope.error

  // ATOMAREN scoped delete: cross-tenant ali neobstoječi id → count 0 → ISTI
  // unificiran 404 (zero-oracle, en sam db klic — ni findFirst+delete race).
  const deleted = await db.webAuthnCredential.deleteMany({
    where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
  })

  if (deleted.count === 0) {
    return notInScopeResponse('Poverilnica')
  }

  return NextResponse.json({ success: true })
}
