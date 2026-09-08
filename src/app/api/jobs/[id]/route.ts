
// FIX CRITICAL: Dovoljene vrednosti za permissions — prepreči injection admin dovoljenja
// P1-13: seznam uvožen iz centralne matrike (+ manage_accounting)
import { db, createAuditLog } from '@/lib/db'
import { parsePermissions } from '@/lib/json-fields'
import { requireAuth, revokeEmployeeSessions } from '@/lib/auth-middleware'
import { ALL_PERMISSIONS } from '@/lib/auth-middleware/permission-matrix'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { z } from 'zod'

const VALID_PERMISSIONS = ALL_PERMISSIONS

const updateJobSchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(200).optional(),
  code: z.string().max(50).optional(),
  basePayRate: z.number().min(0, 'Plačilo ne more biti negativno').max(1000, 'Plačilo ne more preseči 1000/h').optional(),
  overtimeRate: z.number().min(0).max(2000).optional(),
  // FIX CRITICAL: Validiraj, da permissions vsebuje samo dovoljene vrednosti
  permissions: z.string().max(5000).refine(val => {
    try {
      const parsed = JSON.parse(val)
      if (!Array.isArray(parsed)) return false
      return parsed.every((p: string) => VALID_PERMISSIONS.includes(p as typeof VALID_PERMISSIONS[number]))
    } catch { return false }
  }, 'Permissions mora biti veljaven JSON array z dovoljenimi vrednostmi').optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
})

export const dynamic = 'force-dynamic'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX CRITICAL: Zod validacija — prepreči injection nepričakovanih polj/vrednosti
    const { data, error: validationError } = validateBody(updateJobSchema, bodyResult.data)
    if (validationError) return validationError

    // FIX CRITICAL: Samo admin lahko dodeli admin dovoljenje delovnemu mestu
    // P1-9: Zod-validiran parser (brez gologa JSON.parse)
    if (data.permissions !== undefined) {
      const perms: string[] = parsePermissions(data.permissions)
      if (perms.includes('admin') && authResult.session?.role !== 'admin') {
        return NextResponse.json({ error: 'Samo administrator lahko dodeli admin dovoljenje delovnemu mestu.' }, { status: 403 })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.code !== undefined) updateData.code = data.code
    if (data.basePayRate !== undefined) updateData.basePayRate = data.basePayRate
    if (data.overtimeRate !== undefined) updateData.overtimeRate = data.overtimeRate
    if (data.permissions !== undefined) updateData.permissions = data.permissions
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder

    const job = await db.job.update({
      where: { id },
      data: updateData,
      include: {
        employees: { include: { employee: { select: { id: true, name: true } } } },
      },
    })

    // P1-11: če so se dovoljenja (ali aktivnost) spremenila, imajo obstoječe
    // seje zaposlenih s tem delovnim mestom ZASTAREL permissions snapshot
    // (velja do 8h). Revociraj seje vseh dotičnih zaposlenih → POS zahteva
    // ponovno prijavo z novimi dovoljenji.
    const permissionsChanged = data.permissions !== undefined
    const activationChanged = data.isActive !== undefined
    if (permissionsChanged || activationChanged) {
      const affected = await db.employeeJob.findMany({
        where: { jobId: id },
        select: { employeeId: true },
      })
      for (const ej of affected) {
        await revokeEmployeeSessions(ej.employeeId, 'job-permissions-changed').catch(() => {})
      }
      await createAuditLog({
        userId: authResult.session?.employeeId,
        action: 'JOB_PERMISSIONS_CHANGED',
        entityType: 'Job',
        entityId: id,
        details: { affectedEmployees: affected.length, permissions: data.permissions, isActive: data.isActive },
      }).catch(() => {})
    }

    return NextResponse.json(deepToNumbers(job))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/jobs/[id]', 'Napaka pri posodabljanju delovnega mesta')
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const { id } = await params

    // P1-11: pred brisanjem preveri ali ima job še dodeljene zaposlene —
    // brisanje pobriše EmployeeJob povezave (cascade), zaposleni pa bi ostali
    // brez delovnega mesta oz. dovoljenj. Zavrni, dokler so zadolžitve aktivne.
    const assigned = await db.employeeJob.count({ where: { jobId: id } })
    if (assigned > 0) {
      return NextResponse.json(
        { error: `Delovno mesto ima ${assigned} dodeljenih zaposlenih — najprej jim dodelite drugo delovno mesto.` },
        { status: 400 }
      )
    }

    await db.job.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/jobs/[id]', 'Napaka pri brisanju delovnega mesta')
  }
}
