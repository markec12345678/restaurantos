import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { printRequestSchema, handleOrderPrint, handleReceiptPrint, handleTestPrint } from './_helpers'


// ============================================
// POST /api/print — Tiskanje na omrežni tiskalnik (ESC/POS over TCP/IP)
// ============================================

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // Rate limiting — prepreči zlorabo API-ja
  const rl = await checkRateLimitAsync('print', getClientIp(req), AUTHENTICATED_LIMIT)
  if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

  // FIX C-07: Zahtevaj avtentikacijo za tiskanje
  const authResult = await requireAuth(req, { permission: 'take_orders' })
  if (authResult.error) return authResult.error

  try {
    const { data, error: validationError } = await validateRequest(req, printRequestSchema)
    if (validationError) return validationError

    const { type, orderId, printerId } = data

    switch (type) {
      case 'order': {
        const result = await handleOrderPrint(orderId!, printerId)
        if ('status' in result && result.status) {
          return NextResponse.json(result, { status: result.status as number })
        }
        return NextResponse.json(result)
      }
      case 'receipt': {
        const result = await handleReceiptPrint(orderId!, printerId, authResult.session)
        if ('status' in result && result.status) {
          return NextResponse.json(result, { status: result.status as number })
        }
        return NextResponse.json(result)
      }
      case 'test': {
        const result = await handleTestPrint(printerId)
        return NextResponse.json(result)
      }
      default:
        return NextResponse.json({ error: 'Neznan tip tiskanja' }, { status: 400 })
    }
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/print', 'Napaka pri tiskanju')
  }
}
