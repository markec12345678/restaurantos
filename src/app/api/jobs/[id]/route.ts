
// FIX CRITICAL: Dovoljene vrednosti za permissions — prepreči injection admin dovoljenja
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const VALID_PERMISSIONS = [
  'take_orders', 'void_items', 'apply_discounts', 'manage_cash',
  'manage_inventory', 'manage_employees', 'view_reports', 'admin',
] as const

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
    if (data.permissions !== undefined) {
      try {
        const perms: string[] = JSON.parse(data.permissions)
        if (perms.includes('admin') && authResult.session?.role !== 'admin') {
          return NextResponse.json({ error: 'Samo administrator lahko dodeli admin dovoljenje delovnemu mestu.' }, { status: 403 })
        }
      } catch {
        // Already validated by Zod — safe to ignore
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

    return NextResponse.json(job)
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

    // Delete related employee-job assignments first
    await db.employeeJob.deleteMany({ where: { jobId: id } })

    await db.job.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/jobs/[id]', 'Napaka pri brisanju delovnega mesta')
  }
}
