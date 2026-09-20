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
import type { RegistrationResponseJSON } from '@simplewebauthn/server'

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

  // FIX R81-F: 'super_admin' dodan k admin path (ADMIN_ROLES konvencija,
  // enako kot credentials/[id] R79).
  const isRoleAdmin = session.role === 'admin' || session.role === 'super_admin'
  const isAdmin = isRoleAdmin || session.permissions.includes('manage_employees')
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

  // FIX R81-F (LEAK-HIGH, cross-tenant account takeover): admin path je sme
  // registrirati WebAuthn poverilnico za POLJUBEN employeeId BREZ preverjanja
  // lokacije ciljnega zaposlenega — lokacijsko vezan manager je lahko
  // registriral SVOJ authenticator na tujega zaposlenega in se prek
  // POST /api/auth/webauthn prijavil kot on. Owner-location matrika
  // (enako kot credentials/[id] R79, fail-closed brez razkritja):
  //   - role admin/super_admin + session.locationId=null → globalni dostop
  //   - lokacijsko vezan upravljavec → SAMO zaposleni svoje lokacije
  //   - upravljavec brez lokacije → 403 (data integrity issue)
  //   - ciljni zaposleni z NULL lokacijo → 403 za non-super-admin
  // En sam fetch ciljnega zaposlenega z locationId (scope + status + ime).
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { name: true, status: true, locationId: true },
  })
  if (!employee) {
    return NextResponse.json({ error: 'Zaposleni ni aktiven.' }, { status: 404 })
  }

  if (employeeId !== session.employeeId) {
    const isSuperAdminGlobal = isRoleAdmin && !session.locationId
    if (!isSuperAdminGlobal) {
      if (!session.locationId) {
        return NextResponse.json(
          { error: 'Vaš račun nima dodeljene lokacije. Kontaktirajte administratorja.' },
          { status: 403 }
        )
      }
      if (employee.locationId !== session.locationId) {
        // Tuj ALI NULL-location zaposleni → 403 (ne razkrivamo obstoja/statusa)
        return NextResponse.json(
          { error: 'Nimate dovoljenja za registracijo biometrije za drugega zaposlenega.' },
          { status: 403 }
        )
      }
    }
  }

  if (employee.status !== 'active') {
    return NextResponse.json({ error: 'Zaposleni ni aktiven.' }, { status: 404 })
  }

  const existingCreds = await listEmployeeCredentials(employeeId)

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

  // FIX R81-F: 'super_admin' dodan k admin path (ADMIN_ROLES konvencija).
  const isRoleAdmin = session.role === 'admin' || session.role === 'super_admin'
  const isAdmin = isRoleAdmin || session.permissions.includes('manage_employees')
  const employeeId = bodyEmployeeId || session.employeeId
  if (!isAdmin && employeeId !== session.employeeId) {
    return NextResponse.json(
      { error: 'Nimate dovoljenja za registracijo za drugega zaposlenega.' },
      { status: 403 }
    )
  }

  // FIX R81-F (LEAK-HIGH, cross-tenant account takeover): isti owner-location
  // matriki kot v GET (in credentials/[id] R79) — brez tega je lokacijsko
  // vezan manager lahko VPISAL poverilnico na tujega zaposlenega. Check
  // teče PRED takeChallenge/verify (nič se ne sme zgoditi za tuj target).
  if (employeeId !== session.employeeId) {
    const isSuperAdminGlobal = isRoleAdmin && !session.locationId
    if (!isSuperAdminGlobal) {
      if (!session.locationId) {
        return NextResponse.json(
          { error: 'Vaš račun nima dodeljene lokacije. Kontaktirajte administratorja.' },
          { status: 403 }
        )
      }
      const owner = await db.employee.findUnique({
        where: { id: employeeId },
        select: { locationId: true },
      })
      if (!owner || owner.locationId !== session.locationId) {
        return NextResponse.json(
          { error: 'Nimate dovoljenja za registracijo za drugega zaposlenega.' },
          { status: 403 }
        )
      }
    }
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
