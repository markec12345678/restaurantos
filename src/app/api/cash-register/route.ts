
import { db } from '@/lib/db'
import { toNum, deepToNumbers } from '@/lib/decimal'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { emitEvent } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleRouteError, handleApiError, validateRequest } from '@/lib/api-utils'
import { openShiftSchema, calculateLiveStats, openShift } from './_helpers'


// GET /api/cash-register — Get current and recent shifts
export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('cash-register', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    // FIX C-07: Zahtevaj avtentikacijo za blagajno
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    // FIX HIGH: Get currently open shift with location filtering
    const { searchParams } = new URL(req.url)
    const locationId = searchParams.get('locationId')
    const shiftWhere: Record<string, unknown> = { status: 'open' }
    if (locationId) shiftWhere.locationId = locationId

    const activeShift = await db.cashRegisterShift.findFirst({
      where: shiftWhere,
      orderBy: { openedAt: 'desc' },
    })

    // If there's an active shift, calculate live stats
    let liveStats: Record<string, number> | null = null
    if (activeShift) {
      liveStats = await calculateLiveStats(activeShift)
    }

    // Get recent closed shifts
    // FIX BUG-6 MEDIUM: Dodaj locationId filter — brez tega se prikažejo izmene vseh lokacij
    const recentShiftsWhere: Record<string, unknown> = { status: 'closed' }
    if (locationId) recentShiftsWhere.locationId = locationId
    const recentShifts = await db.cashRegisterShift.findMany({
      where: recentShiftsWhere,
      orderBy: { closedAt: 'desc' },
      take: 10,
    })

    return NextResponse.json(deepToNumbers({ activeShift, liveStats, recentShifts }))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/cash-register', 'Napaka pri pridobivanju blagajne')
  }
}

// POST /api/cash-register — Open a new shift
export async function POST(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('cash-register', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })

    // FIX C-07: Zahtevaj avtentikacijo za odpiranje izmene
    const authResult = await requireAuth(req, { permission: 'manage_cash' })
    if (authResult.error) return authResult.error

    // FIX: Validiraj vnos z validateRequest — vključuje 1MB omejitev in sanatizacijo
    const { data, error: validationError } = await validateRequest(req, openShiftSchema)
    if (validationError) return validationError

    // FIX BUG-09: Preveri in ustvari izmeno v transakciji — prepreči race condition
    const shift = await openShift(data)

    // Webhook: cash_register.opened
    emitEvent('cash_register.opened', {
      shiftId: shift.id,
      employeeName: data.employeeName || '',
      startingCash: data.startingCash,
    }).catch(err => logger.error('API', '[Webhook] cash_register.opened napaka:', err))

    return NextResponse.json(shift)
  } catch (error: unknown) {
    return handleRouteError(error, 'POST /api/cash-register', [
      { match: 'ALREADY_OPEN', message: 'Že obstaja odprta izmena. Najprej zaprite trenutno izmeno.', status: 400 },
      { match: 'EMPLOYEE_ID_REQUIRED', message: 'Identifikacija zaposlenega je obvezna za odpiranje izmene.', status: 400 },
      { match: 'STARTING_CASH_MISMATCH', message: 'Začetna gotovina se ne ujema s končnim stanjem prejšnje izmene. Preverite in vnesite pravilen znesek.', status: 409, extra: (parts) => ({ expectedCash: toNum(parts[1] || '0'), actualCash: toNum(parts[2] || '0') }) },
    ], 'Napaka pri odpiranju izmene')
  }
}
