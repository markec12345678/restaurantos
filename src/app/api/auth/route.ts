import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

// ============================================
// PIN AVTENTIKACIJA ZA POS SISTEM
// Hitra prijava zaposlenih s 4-mestnim PIN-om
// ============================================

// POST /api/auth/login — Prijava z PIN-om
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { pin } = body

    if (!pin || pin.length < 4) {
      return NextResponse.json({ error: 'PIN mora imeti vsaj 4 števke' }, { status: 400 })
    }

    const employee = await db.employee.findFirst({
      where: { pin, status: 'active' },
      include: {
        jobs: {
          include: { job: true },
        },
      },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Napačen PIN ali nedejaven uporabnik' }, { status: 401 })
    }

    // Pridobi dovoljenja iz vseh funkcij
    const allPermissions: string[] = []
    let primaryJob = employee.jobs.find(j => j.isPrimary)?.job || employee.jobs[0]?.job

    for (const ej of employee.jobs) {
      try {
        const perms = JSON.parse(ej.job.permissions || '[]')
        allPermissions.push(...perms)
      } catch {}
    }

    // Unikatna dovoljenja
    const permissions = [...new Set(allPermissions)]

    // Generiraj session token
    const token = crypto.randomBytes(32).toString('hex')

    return NextResponse.json({
      success: true,
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        primaryJob: primaryJob ? {
          id: primaryJob.id,
          name: primaryJob.name,
          payRate: primaryJob.basePayRate,
        } : null,
        permissions,
      },
      token,
      message: `Dobrodošli, ${employee.name}!`,
    })
  } catch (error) {
    console.error('Auth login error:', error)
    return NextResponse.json({ error: 'Napaka pri prijavi' }, { status: 500 })
  }
}

// GET /api/auth — Preveri stanje avtentikacije
export async function GET() {
  try {
    const employees = await db.employee.findMany({
      where: { status: 'active', pin: { not: '' } },
      select: { id: true, name: true, role: true, pin: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      authEnabled: employees.length > 0,
      employeesWithPin: employees.length,
      employees: employees.map(e => ({ id: e.id, name: e.name, role: e.role })),
    })
  } catch (error) {
    console.error('Auth status error:', error)
    return NextResponse.json({ authEnabled: false }, { status: 500 })
  }
}
