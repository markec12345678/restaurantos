// ============================================
// WEB AUTHN CREDENTIAL LIST
// GET /api/auth/webauthn/credentials?employeeId=xxx
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import type { Session } from '@/lib/auth-middleware'
import { listEmployeeCredentials } from '@/lib/webauthn/db-helpers'
import { db } from '@/lib/db'

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

  // FIX BUG-HUNT R79 (HIGH, tenant scope fail-open): prej je vsak "admin"
  // (role admin ALI manage_employees dovoljenje) lahko z ?employeeId= enumeriral
  // poverilnice KATEREGA KOLI zaposlenega v VSEH tenantih — brez lokacijskega
  // preverjanja (isti razred kot runda 77: null/wrong locationId → fail-open).
  //
  // Zdaj (konsistentno z resolveTenantLocationId konvencijo):
  //   - role admin + session.locationId=null (super-admin) → globalni dostop
  //   - location-bound upravljavec (role admin ALI manage_employees) → SAMO
  //     poverilnice zaposlenih svoje lokacije (target.locationId === session.locationId)
  //   - upravljavec brez session.locationId → fail-closed 403
  //   - navaden uporabnik → samo svoje poverilnice (nespremenjeno)
  const isRoleAdmin = session.role === 'admin' || session.role === 'super_admin'
  const hasManagePerm = session.permissions.includes('manage_employees')
  const canManage = isRoleAdmin || hasManagePerm
  const isSuperAdminGlobal = isRoleAdmin && !session.locationId

  if (!canManage && requestedEmployeeId && requestedEmployeeId !== session.employeeId) {
    return NextResponse.json(
      { error: 'Nimate dovoljenja za pregled tujih poverilnic.' },
      { status: 403 }
    )
  }

  let employeeId = session.employeeId
  if (canManage && requestedEmployeeId && requestedEmployeeId !== session.employeeId) {
    if (isSuperAdminGlobal) {
      employeeId = requestedEmployeeId
    } else {
      if (!session.locationId) {
        return NextResponse.json(
          { error: 'Vaš račun nima dodeljene lokacije. Kontaktirajte administratorja.' },
          { status: 403 }
        )
      }
      const target = await db.employee.findUnique({
        where: { id: requestedEmployeeId },
        select: { locationId: true },
      })
      if (!target || target.locationId !== session.locationId) {
        return NextResponse.json(
          { error: 'Nimate dovoljenja za pregled tujih poverilnic.' },
          { status: 403 }
        )
      }
      employeeId = requestedEmployeeId
    }
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
