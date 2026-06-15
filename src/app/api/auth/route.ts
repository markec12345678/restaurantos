import { NextResponse } from 'next/server'
import { verifyToken, destroySession } from '@/lib/auth-middleware'
import { loginSchema, authResponseSchema, authStatusResponseSchema } from '@/lib/validations'
import { checkRateLimit, getClientIp, LOGIN_LIMIT } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { generateCsrfToken } from '@/lib/csrf'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { verifyPin, buildAuthResponse, buildAuthStatusResponse } from './_helpers'

// ============================================
// PIN AVTENTIKACIJA ZA POS SISTEM
// Profesionalna prijava s session managementom
// bcrypt hash + rate limiting + session tokens
// FIX MEDIUM: Uporablja skupni rate-limit.ts modul
// ============================================

// POST /api/auth — Prijava z PIN-om
export async function POST(req: Request) {
  try {
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(loginSchema, bodyResult.data)
    if (validationError) return validationError

    // Rate limiting
    const clientIp = getClientIp(req)
    const rateCheck = checkRateLimit('auth-login', clientIp, LOGIN_LIMIT)
    if (!rateCheck.allowed) {
      const retryMin = Math.ceil((rateCheck.retryAfterMs || 900000) / 60000)
      return NextResponse.json(
        { error: `Preveč neuspešnih poskusov. Poskusite znova čez ${retryMin} min.` },
        { status: 429 }
      )
    }

    const matchedEmployee = await verifyPin(data)
    if (!matchedEmployee) {
      return NextResponse.json({ error: 'Napačen PIN ali nedejaven uporabnik' }, { status: 401 })
    }

    const responseData = buildAuthResponse(matchedEmployee)

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
    logger.error('API', 'Auth status error:', error)
    return NextResponse.json({ authEnabled: false, authenticated: false }, { status: 500 })
  }
}

// DELETE /api/auth — Odjava (uniči sejo)
export async function DELETE(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim()
      destroySession(token)
    }
    return NextResponse.json({ success: true, message: 'Uspešno odjavljeni' })
  } catch {
    return NextResponse.json({ success: true })
  }
}
