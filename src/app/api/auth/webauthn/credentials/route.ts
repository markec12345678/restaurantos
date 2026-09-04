// ============================================
// WEB AUTHN CREDENTIAL LIST
// GET /api/auth/webauthn/credentials?employeeId=xxx
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import type { Session } from '@/lib/auth-middleware'
import { listEmployeeCredentials } from '@/lib/webauthn/db-helpers'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
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

  const url = new URL(req.url)
  const requestedEmployeeId = url.searchParams.get('employeeId')

  const isAdmin = session.role === 'admin' || session.permissions.includes('manage_employees')
  const employeeId = isAdmin && requestedEmployeeId ? requestedEmployeeId : session.employeeId
  if (!isAdmin && requestedEmployeeId && requestedEmployeeId !== session.employeeId) {
    return NextResponse.json(
      { error: 'Nimate dovoljenja za pregled tujih poverilnic.' },
      { status: 403 }
    )
  }

  const credentials = await listEmployeeCredentials(employeeId)

  return NextResponse.json({
    employeeId,
    credentials: credentials.map((c) => ({
      id: c.id,
      credentialId: c.credentialId,
      deviceType: c.deviceType,
      backed: c.backed,
      nickname: c.nickname,
      lastUsedAt: c.lastUsedAt,
      createdAt: c.createdAt,
    })),
  })
}
