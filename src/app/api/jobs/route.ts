import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody } from '@/lib/validations'
import { NextResponse } from 'next/server'
import { z } from 'zod'

// Zod validacija za kreiranje delovnega mesta
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
  } catch (error) {
    console.error('Failed to fetch jobs:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju delovnih mest' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX HIGH: Zod validacija za kreiranje delovnega mesta — prepreči neveljavne vnose
    const { data, error: validationError } = validateBody(createJobSchema, body)
    if (validationError) return validationError

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
  } catch (error) {
    console.error('Failed to create job:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju delovnega mesta' }, { status: 500 })
  }
}
