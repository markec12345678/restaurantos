import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
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
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    const job = await db.job.create({
      data: {
        name: body.name,
        code: body.code || '',
        basePayRate: body.basePayRate || 0,
        overtimeRate: body.overtimeRate || 0,
        permissions: body.permissions || '[]',
        isActive: body.isActive !== undefined ? body.isActive : true,
        sortOrder: body.sortOrder || 0,
      },
      include: {
        employees: true,
      },
    })

    return NextResponse.json(job, { status: 201 })
  } catch (error) {
    console.error('Failed to create job:', error)
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
  }
}
