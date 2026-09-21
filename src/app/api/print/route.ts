import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { printRequestSchema, handleOrderPrint, handleReceiptPrint, handleTestPrint } from './_helpers'


// ============================================
// POST /api/print — Tiskanje na omrežni tiskalnik (ESC/POS over TCP/IP)
// ============================================

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // Rate limiting — prepreči zlorabo API-ja
  const rl = await checkRateLimitAsync('print', getClientIp(req), AUTHENTICATED_LIMIT)
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

  // FIX C-07: Zahtevaj avtentikacijo za tiskanje
  const authResult = await requireAuth(req, { permission: 'take_orders' })
  if (authResult.error) return authResult.error

  // FIX R86-4 (MEDIUM): tenant scope — brez scopa je kateri koli avtenticiran
  // uporabnik lahko natisnil TUJE naročilo/račun (vsebina: artikli, gost, zneski)
  // na svoje ali tujе tiskalnike. Scope PRED vsemi handlerji (gate ordering).
  const scope = resolveTenantLocationIdOrThrow(authResult.session, null, {
    endpoint: 'POST /api/print',
  })
  if ('error' in scope) return scope.error

  try {
    const { data, error: validationError } = await validateRequest(req, printRequestSchema)
    if (validationError) return validationError

    const { type, orderId, printerId } = data

    switch (type) {
      case 'order': {
        const result = await handleOrderPrint(orderId!, printerId, scope.locationId)
        if ('status' in result && result.status) {
          return NextResponse.json(result, { status: result.status as number })
        }
        return NextResponse.json(result)
      }
      case 'receipt': {
        const result = await handleReceiptPrint(orderId!, printerId, authResult.session, scope.locationId)
        if ('status' in result && result.status) {
          return NextResponse.json(result, { status: result.status as number })
        }
        return NextResponse.json(result)
      }
      case 'test': {
        const result = await handleTestPrint(printerId, scope.locationId)
        return NextResponse.json(result)
      }
      default:
        return NextResponse.json({ error: 'Neznan tip tiskanja' }, { status: 400 })
    }
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/print', 'Napaka pri tiskanju')
  }
}
