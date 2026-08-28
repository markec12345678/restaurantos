// ============================================
// WEB AUTHN LOGIN ROUTE
// GET  /api/auth/webauthn         → generiraj challenge za navigator.credentials.get()
// POST /api/auth/webauthn         → verificiraj assertion + ustvari session (login)
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession } from '@/lib/auth-middleware'
import { checkRateLimit, getClientIp, LOGIN_LIMIT } from '@/lib/rate-limit'
import { parseJsonBody } from '@/lib/api-utils'
import { logger } from '@/lib/logger'
import {
  isWebAuthnEnable,
  buildAuthenticationOptions,
  verifyAssertion,
  getWebAuthnConfig,
} from '@/lib/webauthn'
import { saveChallenge, takeChallenge } from '@/lib/webauthn/challenge-store'
import { findCredential, updateCounterAfterUse } from '@/lib/webauthn/db-helpers'
import { createAuditLog } from '@/lib/db'
import type { AuthenticationResponseJSON } from '@simplewebauthn/types'

export const dynamic = 'force-dynamic'

// ─── GET: generiraj WebAuthn authentication challenge ───
export async function GET(req: Request) {
  if (!isWebAuthnEnable()) {
    return NextResponse.json(
      {
        error: 'WebAuthn biometric login je onemogočen.',
        reason: 'WEBAUTHN_ENABLED ni "true" ali pa nisi v produkciji s HTTPS.',
        hint: 'Nastavi WEBAUTHN_ENABLED=true v .env (samo za testno okolje) ali uporabljaj PIN prijavo.',
        docs: '/SECURITY.md#webauthn',
      },
      { status: 503 }
    )
  }

  const clientIp = getClientIp(req)
  const rateCheck = checkRateLimit('webauthn-challenge', clientIp, LOGIN_LIMIT)
  if (!rateCheck.allowed) {
    const retryMin = Math.ceil((rateCheck.retryAfterMs || 900000) / 60000)
    return NextResponse.json(
      { error: `Preveč zahtevkov. Poskusite znova čez ${retryMin} min.` },
      { status: 429 }
    )
  }

  try {
    const options = await buildAuthenticationOptions()
    const config = getWebAuthnConfig()

    const sessionKey = crypto.randomUUID()
    saveChallenge(sessionKey, options.challenge)

    const res = NextResponse.json({
      options,
      sessionKey,
      rpID: config.rpID,
      timeout: options.timeout,
    })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (err) {
    logger.error('WEBAUTHN', 'Napaka pri generiranju authentication challenge-a:', err)
    return NextResponse.json(
      { error: 'Napaka pri pripravi biometrične prijave.' },
      { status: 500 }
    )
  }
}

// ─── POST: verificiraj assertion in ustvari session ───
export async function POST(req: Request) {
  if (!isWebAuthnEnable()) {
    return NextResponse.json(
      { error: 'WebAuthn biometric login je onemogočen.' },
      { status: 503 }
    )
  }

  const clientIp = getClientIp(req)
  const rateCheck = checkRateLimit('webauthn-login', clientIp, LOGIN_LIMIT)
  if (!rateCheck.allowed) {
    const retryMin = Math.ceil((rateCheck.retryAfterMs || 900000) / 60000)
    return NextResponse.json(
      { error: `Preveč neuspešnih poskusov. Poskusite znova čez ${retryMin} min.` },
      { status: 429 }
    )
  }

  const bodyResult = await parseJsonBody(req)
  if (bodyResult.error) return bodyResult.error

  const { assertion, sessionKey } = (bodyResult.data || {}) as {
    assertion?: AuthenticationResponseJSON
    sessionKey?: string
  }

  if (!assertion || !sessionKey || typeof sessionKey !== 'string') {
    return NextResponse.json(
      { error: 'Manjka assertion ali sessionKey.' },
      { status: 400 }
    )
  }

  const expectedChallenge = takeChallenge(sessionKey)
  if (!expectedChallenge) {
    return NextResponse.json(
      {
        error: 'Challenge je potekel ali ni bil najden.',
        hint: 'Zahtevajte nov challenge z GET /api/auth/webauthn.',
      },
      { status: 400 }
    )
  }

  const credential = await findCredential(assertion.id)
  if (!credential) {
    await new Promise((r) => setTimeout(r, 50))
    return NextResponse.json(
      { error: 'Biometrična prijava ni uspela.' },
      { status: 401 }
    )
  }

  const result = await verifyAssertion(assertion, expectedChallenge, credential)
  if (!result.verified || !result.authenticationInfo) {
    await createAuditLog({
      action: 'WEBAUTHN_LOGIN_FAILED',
      entityType: 'BiometricCredential',
      entityId: credential.credentialId,
      ipAddress: clientIp,
    })
    return NextResponse.json(
      { error: 'Biometrična prijava ni uspela.' },
      { status: 401 }
    )
  }

  try {
    await updateCounterAfterUse(credential.credentialId, result.authenticationInfo.newCounter)
  } catch (err) {
    logger.warn('WEBAUTHN', 'Napaka pri posodabljanju counter-ja:', err)
  }

  const employee = await db.employee.findUnique({
    where: { id: credential.employeeId },
    include: { jobs: { include: { job: true } } },
  })
  if (!employee || employee.status !== 'active') {
    return NextResponse.json(
      { error: 'Zaposleni ni aktiven.' },
      { status: 403 }
    )
  }

  const allPermissions: string[] = []
  for (const ej of employee.jobs) {
    try {
      const perms = JSON.parse(ej.job.permissions || '[]')
      allPermissions.push(...perms)
    } catch { /* ignore */ }
  }
  const permissions = [...new Set(allPermissions)]

  const userAgent = req.headers.get('user-agent') || ''
  const token = await createSession(
    {
      id: employee.id,
      role: employee.role,
      permissions,
    },
    clientIp,
    userAgent,
  )

  await createAuditLog({
    userId: employee.id,
    action: 'WEBAUTHN_LOGIN_SUCCESS',
    entityType: 'BiometricCredential',
    entityId: credential.credentialId,
    ipAddress: clientIp,
    details: { nickname: credential.nickname },
  })

  const primaryJob = employee.jobs.find((j) => j.isPrimary)?.job || employee.jobs[0]?.job

  return NextResponse.json({
    success: true,
    employee: {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      role: employee.role,
      primaryJob: primaryJob
        ? {
            id: primaryJob.id,
            name: primaryJob.name,
            payRate: Number(primaryJob.basePayRate),
          }
        : null,
      permissions,
    },
    token,
    method: 'webauthn',
    message: `Dobrodošli, ${employee.name}! (biometrična prijava)`,
  })
}
