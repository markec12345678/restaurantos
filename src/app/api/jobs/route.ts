
// Zod validacija za kreiranje delovnega mesta
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const createJobSchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(200),
  code: z.string().max(50).default(''),
  basePayRate: z.number().min(0).default(0),
  overtimeRate: z.number().min(0).default(0),
  permissions: z.string().max(5000).default('[]'),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
})

export async function GET(req: Request) {
  try {
    // FIX CRITICAL: Zahtevaj avtentikacijo za branje delovnih mest — izpostavlja dovoljenja in plačne podatke
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const isActive = searchParams.get('isActive')

    const where: Record<string, unknown> = {}
    if (isActive !== null) where.isActive = isActive === 'true'

    const jobs = await db.job.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        employees: { include: { employee: { select: { id: true, name: true } } } },
      },
    })

    return NextResponse.json(jobs)
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/jobs', 'Napaka pri pridobivanju delovnih mest')
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX HIGH: Zod validacija za kreiranje delovnega mesta — prepreči neveljavne vnose
    const { data, error: validationError } = validateBody(createJobSchema, bodyResult.data)
    if (validationError) return validationError

    // FIX CRITICAL: Samo admin lahko dodeli admin dovoljenje delovnemu mestu
    if (data.permissions) {
      try {
        const perms: string[] = JSON.parse(data.permissions)
        if (perms.includes('admin') && authResult.session?.role !== 'admin') {
          return NextResponse.json({ error: 'Samo administrator lahko dodeli admin dovoljenje delovnemu mestu.' }, { status: 403 })
        }
      } catch {
        // Invalid JSON — already validated by Zod
      }
    }

    const job = await db.job.create({
      data: {
        name: data.name,
        code: data.code,
        basePayRate: data.basePayRate,
        overtimeRate: data.overtimeRate,
        permissions: data.permissions,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      },
      include: {
        employees: true,
      },
    })

    return NextResponse.json(job, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/jobs', 'Napaka pri ustvarjanju delovnega mesta')
  }
}
