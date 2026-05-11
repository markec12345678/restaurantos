import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, createEmployeeSchema } from '@/lib/validations'

export async function GET(req: Request) {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za seznam zaposlenih
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error
    const employees = await db.employee.findMany({
      orderBy: { name: 'asc' },
      include: { shifts: true, jobs: { include: { job: true } } },
    })
    // FIX C-06: Nikoli ne vračaj PIN-ov v odgovoru
    const safeEmployees = employees.map(emp => ({
      ...emp,
      pin: emp.pin ? '****' : '',
    }))
    return NextResponse.json(safeEmployees)
  } catch (error) {
    console.error('Napaka pri pridobivanju zaposlenih:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju zaposlenih' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(createEmployeeSchema, body)
    if (validationError) return validationError

    // FIX C-04: Hash PIN z bcrypt pred shranjevanjem
    let hashedPin = ''
    if (data.pin && data.pin.length >= 4) {
      hashedPin = await bcrypt.hash(data.pin, 10)
    }

    const employee = await db.employee.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: data.role,
        status: data.status,
        hireDate: data.hireDate ? new Date(data.hireDate) : new Date(),
        pin: hashedPin,
      },
    })

    // Ustvari EmployeeJob, če je podan jobId
    if (data.jobId) {
      await db.employeeJob.create({
        data: {
          employeeId: employee.id,
          jobId: data.jobId,
          payRate: data.payRate || 0,
          isPrimary: true,
        },
      })
    }

    // Vrni brez PIN-a
    return NextResponse.json({ ...employee, pin: hashedPin ? '****' : '' }, { status: 201 })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: `Zaposleni s tem emailom že obstaja` },
        { status: 409 }
      )
    }
    console.error('Napaka pri ustvarjanju zaposlenega:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju zaposlenega' }, { status: 500 })
  }
}
