// ============================================
// WEB AUTHN REGISTRATION ROUTE
// GET  /api/auth/webauthn/register  → generiraj registration options + challenge
// POST /api/auth/webauthn/register  → verificiraj registration + shrani credential
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import type { Session } from '@/lib/auth-middleware'
import { parseJsonBody } from '@/lib/api-utils'
import { logger } from '@/lib/logger'
import {
  isWebAuthnEnable,
  buildRegistrationOptions,
  verifyRegistration,
  getWebAuthnConfig,
} from '@/lib/webauthn'
import { saveChallenge, takeChallenge } from '@/lib/webauthn/challenge-store'
import { storeCredential, listEmployeeCredentials } from '@/lib/webauthn/db-helpers'
import { createAuditLog, db } from '@/lib/db'
import type { RegistrationResponseJSON } from '@simplewebauthn/types'

export const dynamic = 'force-dynamic'

// ─── GET: generiraj registration options ───
export async function GET(req: Request) {
  let session: Session | null = null
  const adminAuth = await requireAuth(req, { permission: ['admin', 'manage_employees'] })
  if (adminAuth.session) {
    session = adminAuth.session
  } else {
    const selfAuth = await requireAuth(req)
    if (selfAuth.error) return selfAuth.error
    session = selfAuth.session
  }
  if (!session) {
    return NextResponse.json({ error: 'Neavtenticiran.' }, { status: 401 })
  }

  if (!isWebAuthnEnable()) {
    return NextResponse.json(
      {
        error: 'WebAuthn registracija je onemogočena.',
        reason: 'WEBAUTHN_ENABLED ni "true" ali pa nisi v produkciji s HTTPS.',
        hint: 'Nastavi WEBAUTHN_ENABLED=true v .env.',
        docs: '/SECURITY.md#webauthn',
      },
      { status: 503 }
    )
  }

  const url = new URL(req.url)
  const requestedEmployeeId = url.searchParams.get('employeeId')

  const isAdmin = session.role === 'admin' || session.permissions.includes('manage_employees')
  let employeeId: string
  if (requestedEmployeeId) {
    if (!isAdmin && requestedEmployeeId !== session.employeeId) {
      return NextResponse.json(
        { error: 'Nimate dovoljenja za registracijo biometrije za drugega zaposlenega.' },
        { status: 403 }
      )
    }
    employeeId = requestedEmployeeId
  } else {
    employeeId = session.employeeId
  }

  const existingCreds = await listEmployeeCredentials(employeeId)

  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { name: true, status: true },
  })
  if (!employee || employee.status !== 'active') {
    return NextResponse.json({ error: 'Zaposleni ni aktiven.' }, { status: 404 })
  }

  try {
    const options = await buildRegistrationOptions(employeeId, employee.name, existingCreds)
    const config = getWebAuthnConfig()

    await saveChallenge(`register:${employeeId}`, options.challenge)

    const res = NextResponse.json({
      options,
      employeeId,
      rpID: config.rpID,
      timeout: options.timeout,
      existingCount: existingCreds.length,
    })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (err) {
    logger.error('WEBAUTHN', 'Napaka pri generiranju registration options:', err)
    return NextResponse.json(
      { error: 'Napaka pri pripravi registracije.' },
      { status: 500 }
    )
  }
}

// ─── POST: verificiraj registration + shrani credential ───
export async function POST(req: Request) {
  let session: Session | null = null
  const adminAuth = await requireAuth(req, { permission: ['admin', 'manage_employees'] })
  if (adminAuth.session) {
    session = adminAuth.session
  } else {
    const selfAuth = await requireAuth(req)
    if (selfAuth.error) return selfAuth.error
    session = selfAuth.session
  }
  if (!session) {
    return NextResponse.json({ error: 'Neavtenticiran.' }, { status: 401 })
  }

  if (!isWebAuthnEnable()) {
    return NextResponse.json(
      { error: 'WebAuthn registracija je onemogočena.' },
      { status: 503 }
    )
  }

  const bodyResult = await parseJsonBody(req)
  if (bodyResult.error) return bodyResult.error

  const { credential, employeeId: bodyEmployeeId, nickname } = (bodyResult.data || {}) as {
    credential?: RegistrationResponseJSON
    employeeId?: string
    nickname?: string
  }

  if (!credential) {
    return NextResponse.json({ error: 'Manjka registration credential.' }, { status: 400 })
  }

  const isAdmin = session.role === 'admin' || session.permissions.includes('manage_employees')
  const employeeId = bodyEmployeeId || session.employeeId
  if (!isAdmin && employeeId !== session.employeeId) {
    return NextResponse.json(
      { error: 'Nimate dovoljenja za registracijo za drugega zaposlenega.' },
      { status: 403 }
    )
  }

  const expectedChallenge = await takeChallenge(`register:${employeeId}`)
  if (!expectedChallenge) {
    return NextResponse.json(
      {
        error: 'Challenge je potekel ali ni bil najden.',
        hint: 'Zahtevajte nov challenge z GET /api/auth/webauthn/register.',
      },
      { status: 400 }
    )
  }

  const result = await verifyRegistration(credential, expectedChallenge)
  if (!result.verified || !result.registrationInfo) {
    await createAuditLog({
      userId: session.employeeId,
      action: 'WEBAUTHN_REGISTER_FAILED',
      entityType: 'Employee',
      entityId: employeeId,
    })
    return NextResponse.json(
      { error: 'Registracija ni uspela. Podpis ali podatek o napravi niso veljavni.' },
      { status: 400 }
    )
  }

  try {
    const saved = await storeCredential(
      employeeId,
      result.registrationInfo,
      (nickname || '').trim().slice(0, 100),
    )

    await createAuditLog({
      userId: session.employeeId,
      action: 'WEBAUTHN_REGISTER_SUCCESS',
      entityType: 'BiometricCredential',
      entityId: saved.credentialId,
      details: {
        employeeId,
        deviceType: saved.deviceType,
        backed: saved.backed,
        nickname: saved.nickname,
      },
    })

    return NextResponse.json({
      success: true,
      credential: {
        id: saved.id,
        credentialId: saved.credentialId,
        deviceType: saved.deviceType,
        backed: saved.backed,
        nickname: saved.nickname,
        createdAt: saved.createdAt,
      },
      message: 'Biometrična poverilnica uspešno registrirana.',
    })
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Ta biometrična poverilnica je že registrirana.' },
        { status: 409 }
      )
    }
    logger.error('WEBAUTHN', 'Napaka pri shranjevanju credential-a:', err)
    return NextResponse.json(
      { error: 'Napaka pri shranjevanju biometrične poverilnice.' },
      { status: 500 }
    )
  }
}
