import { NextResponse } from 'next/server'
import { verifyToken, destroySession } from '@/lib/auth-middleware'
import { loginSchema, authResponseSchema, authStatusResponseSchema } from '@/lib/validations'
import { checkRateLimitAsync, getClientIp, LOGIN_LIMIT } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { generateCsrfToken } from '@/lib/csrf'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { createAuditLog } from '@/lib/db'
import { METRICS, incCounter } from '@/lib/observability'
import { verifyPin, buildAuthResponse, buildAuthStatusResponse } from './_helpers'
import {
  isPinLocked,
  pinLockoutRemainingMs,
  recordPinFailure,
  clearPinFailures,
  progressiveDelayMs,
} from '@/lib/auth-middleware/pin-lockout'


// ============================================
// PIN AVTENTIKACIJA ZA POS SISTEM
// Profesionalna prijava s session managementom
// bcrypt hash + rate limiting + session tokens
// FIX MEDIUM: Uporablja skupni rate-limit.ts modul
//
// P1-11/P1-12 (v1.0.12): PIN hardening:
//  - per-PIN lockout (5 neuspelih poskusov → 15 min zaklep; ključ =
//    HMAC-SHA256(PIN) — deluje tudi za neobstoječe PIN-e, brez razkritja)
//  - progresivni delay (vsaka dodatna napaka +250ms, max 4s)
//  - audit sled LOGIN_SUCCESS / LOGIN_FAILED / LOGIN_FAILED_LOCKOUT / LOGOUT
//  - enoten 401 odgovor (prepreči user enumeracijo)
// ============================================

// POST /api/auth — Prijava z PIN-om
export const dynamic = 'force-dynamic'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function POST(req: Request) {
  try {
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(loginSchema, bodyResult.data)
    if (validationError) return validationError

    // Rate limiting (per-IP)
    const clientIp = getClientIp(req)
    const rateCheck = await checkRateLimitAsync('auth-login', clientIp, LOGIN_LIMIT)
    if (!rateCheck.allowed) {
      const retryMin = Math.ceil((rateCheck.retryAfterMs || 900000) / 60000)
      return NextResponse.json(
        { error: `Preveč neuspešnih poskusov. Poskusite znova čez ${retryMin} min.` },
        { status: 429 }
      )
    }

    // P1-12: per-PIN lockout (ščiti pred distribuiranimi napadi z več IP-jev)
    if (isPinLocked(data.pin)) {
      const remainingSec = Math.ceil(pinLockoutRemainingMs(data.pin) / 1000)
      await createAuditLog({
        action: 'LOGIN_FAILED_LOCKOUT',
        entityType: 'Employee',
        ipAddress: clientIp,
        details: { reason: 'pin_locked', remainingSec, userAgent: req.headers.get('user-agent') || '' },
      })
      // Enak odgovor kot IP rate limit (ne razkriva, ali PIN obstaja)
      return NextResponse.json(
        { error: `Preveč neuspešnih poskusov. Poskusite znova čez ${Math.ceil(remainingSec / 60)} min.` },
        { status: 429, headers: { 'Retry-After': String(remainingSec) } }
      )
    }

    const matchedEmployee = await verifyPin(data)
    if (!matchedEmployee) {
      // P1-12: zapiši neuspešen poskus + progresivni delay pred odgovorom
      // (upočasni avtomatizirano ugibanje PIN-ov)
      const failure = recordPinFailure(data.pin)
      // P1-observability: števec neuspelih prijav (event buffer za alert
      // na vzorec brute-force poskusov)
      incCounter(METRICS.AUTH_LOGIN_FAILED, 1, true)
      const delayMs = progressiveDelayMs(failure.count)
      if (delayMs > 0) await sleep(delayMs)

      // P1-11: audit sled neuspešne prijave (BREZ PIN-a — samo njegov
      // števec poskusov, ki se ne more rekonstruirati v PIN)
      await createAuditLog({
        action: 'LOGIN_FAILED',
        entityType: 'Employee',
        ipAddress: clientIp,
        details: {
          attemptCount: failure.count,
          locked: failure.locked,
          delayMs,
          userAgent: req.headers.get('user-agent') || '',
        },
      })

      // P1-12: enoten odgovor — ne razkrije, ali PIN obstaja ali je
      // uporabnik nedejaven (prepreči user enumeracijo)
      return NextResponse.json({ error: 'Napačen PIN ali nedejaven uporabnik' }, { status: 401 })
    }

    // P1-12: uspešna prijava ponastavi števc neuspelih poskusov za ta PIN
    clearPinFailures(data.pin)
    // P1-observability: uspešne prijave (razmerje failed/success)
    incCounter(METRICS.AUTH_LOGIN_SUCCESS)

    // P1-11: audit sled uspešne prijave
    await createAuditLog({
      userId: matchedEmployee.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'Employee',
      entityId: matchedEmployee.id,
      ipAddress: clientIp,
      details: {
        role: matchedEmployee.role,
        locationId: matchedEmployee.locationId ?? null,
        userAgent: req.headers.get('user-agent') || '',
      },
    })

    const responseData = await buildAuthResponse(matchedEmployee, clientIp, req.headers.get('user-agent') || '')

    try {
      authResponseSchema.parse(responseData)
    } catch (validationError: unknown) {
      logger.error('API', 'Auth response validation failed:', validationError)
      return NextResponse.json({ error: 'Notranja napaka strežnika' }, { status: 500 })
    }

    return NextResponse.json(responseData)
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/auth', 'Napaka pri prijavi')
  }
}

// GET /api/auth — Preveri stanje avtentikacije ALI pridobi CSRF token
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    if (url.searchParams.get('csrf') === '1') {
      return generateCsrfToken()
    }

    const authHeader = req.headers.get('authorization')
    let session: Awaited<ReturnType<typeof verifyToken>> | null = null
    if (authHeader?.startsWith('Bearer ')) {
      session = await verifyToken(authHeader.substring(7).trim())
    }

    const responseData = await buildAuthStatusResponse(session)

    try {
      authStatusResponseSchema.parse(responseData)
    } catch (validationError: unknown) {
      logger.error('API', 'Auth status response validation failed:', validationError)
      return NextResponse.json({ error: 'Notranja napaka strežnika' }, { status: 500 })
    }

    return NextResponse.json(responseData)
  } catch (error: unknown) {
    // FIX SECURITY: Če verifyToken vrže napako (npr. DB napaka v isEmployeeActive),
    // ne vračaj 500 z authEnabled=false — to bi klient dojel kot "offline mode"
    // in dovolil dostop. Vrani 401 (session ni veljaven).
    logger.error('API', 'Auth status error:', error)
    return NextResponse.json({ authenticated: false, authEnabled: true, error: 'Session validation failed' }, { status: 401 })
  }
}

// DELETE /api/auth — Odjava (uniči sejo)
export async function DELETE(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim()
      // P1-11: pred uničenjem preveri sejo — zapiši LOGOUT audit z userId
      // (brez tega bi bil dnevnik prijav brez odjav)
      try {
        const session = await verifyToken(token)
        if (session) {
          await createAuditLog({
            userId: session.employeeId,
            action: 'LOGOUT',
            entityType: 'Employee',
            entityId: session.employeeId,
            ipAddress: getClientIp(req),
            details: { role: session.role },
          })
        }
      } catch {
        // Audit napaka ne sme blokirati odjave
      }
      await destroySession(token)
    }
    return NextResponse.json({ success: true, message: 'Uspešno odjavljeni' })
  } catch {
    return NextResponse.json({ success: true })
  }
}
