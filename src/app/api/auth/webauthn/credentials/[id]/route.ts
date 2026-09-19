// ============================================
// WEB AUTHN CREDENTIAL MANAGEMENT — DELETE
// DELETE /api/auth/webauthn/credentials/[id]
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import type { Session } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'
import { deleteCredential } from '@/lib/webauthn/db-helpers'
import { createAuditLog, db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, { permission: ['admin', 'manage_employees'] })
  let session: Session | null = authResult.session
  if (!session) {
    const selfAuth = await requireAuth(req)
    if (selfAuth.error) return selfAuth.error
    session = selfAuth.session
  }
  if (!session) {
    return NextResponse.json({ error: 'Neavtenticiran.' }, { status: 401 })
  }

  const { id: credentialRowId } = await params
  if (!credentialRowId) {
    return NextResponse.json({ error: 'Manjka ID.' }, { status: 400 })
  }

  const credential = await db.biometricCredential.findUnique({
    where: { id: credentialRowId },
    select: { credentialId: true, employeeId: true, nickname: true },
  })
  if (!credential) {
    return NextResponse.json({ error: 'Poverilnica ni najdena.' }, { status: 404 })
  }

  // FIX BUG-HUNT R79 (HIGH, tenant scope fail-open): prej `if (isAdmin && session.locationId)`
  // je pomenil, da upravljavec z manage_employees dovoljenjem BREZ session.locationId
  // (Employee.locationId je nullable) CELOTEN owner-location check preskoči → lahko je
  // brisal poverilnice zaposlenih VSEH tenantov (isti razred kot runda 77 fail-open GET rute).
  // Poleg tega role check ni poznal 'super_admin' (ADMIN_ROLES konvencija).
  //
  // Zdaj (konsistentno z resolveTenantLocationId):
  //   - role admin + session.locationId=null (super-admin) → globalni dostop
  //   - location-bound upravljavec → samo poverilnice zaposlenih svoje lokacije
  //   - upravljavec brez session.locationId → fail-closed 403
  //   - navaden uporabnik → samo lastne poverilnice (nespremenjeno)
  const isRoleAdmin = session.role === 'admin' || session.role === 'super_admin'
  const hasManagePerm = session.permissions.includes('manage_employees')
  const canManage = isRoleAdmin || hasManagePerm
  const isOwnCredential = credential.employeeId === session.employeeId
  const isSuperAdminGlobal = isRoleAdmin && !session.locationId

  if (!canManage && !isOwnCredential) {
    return NextResponse.json(
      { error: 'Nimate dovoljenja za izbris te poverilnice.' },
      { status: 403 }
    )
  }

  if (canManage && !isOwnCredential && !isSuperAdminGlobal) {
    if (!session.locationId) {
      // Fail-closed: upravljavec brez lokacije = data integrity issue
      return NextResponse.json(
        { error: 'Vaš račun nima dodeljene lokacije. Kontaktirajte administratorja.' },
        { status: 403 }
      )
    }
    const owner = await db.employee.findUnique({
      where: { id: credential.employeeId },
      select: { locationId: true },
    })
    if (!owner || owner.locationId !== session.locationId) {
      return NextResponse.json(
        { error: 'Nimate dovoljenja za izbris te poverilnice.' },
        { status: 403 }
      )
    }
  }

  try {
    const deleted = await deleteCredential(credential.credentialId, credential.employeeId)
    if (!deleted) {
      return NextResponse.json({ error: 'Poverilnica ni bila izbrisana.' }, { status: 500 })
    }

    await createAuditLog({
      userId: session.employeeId,
      action: 'WEBAUTHN_CREDENTIAL_DELETED',
      entityType: 'BiometricCredential',
      entityId: credential.credentialId,
      details: { ownerEmployeeId: credential.employeeId, nickname: credential.nickname },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('WEBAUTHN', 'Napaka pri brisanju credential-a:', err)
    return NextResponse.json(
      { error: 'Napaka pri brisanju biometrične poverilnice.' },
      { status: 500 }
    )
  }
}
