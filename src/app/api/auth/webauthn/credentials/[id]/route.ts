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

  const isAdmin = session.role === 'admin' || session.permissions.includes('manage_employees')
  if (!isAdmin && credential.employeeId !== session.employeeId) {
    return NextResponse.json(
      { error: 'Nimate dovoljenja za izbris te poverilnice.' },
      { status: 403 }
    )
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
