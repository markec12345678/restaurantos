import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export async function GET() {
  try {
    const employees = await db.employee.findMany({
      orderBy: { name: 'asc' },
      include: { shifts: true, jobs: { include: { job: true } } },
    })
    // FIX: Ne vračaj PIN-ov v odgovoru
    const safeEmployees = employees.map(emp => ({
      ...emp,
      pin: emp.pin ? '****' : '', // Maskiraj PIN
    }))
    return NextResponse.json(safeEmployees)
  } catch (error) {
    console.error('Napaka pri pridobivanju zaposlenih:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju zaposlenih' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (!body.name || !body.email) {
      return NextResponse.json({ error: 'Ime in email sta obvezna' }, { status: 400 })
    }

    // FIX C-04: Hash PIN z bcrypt pred shranjevanjem
    let hashedPin = ''
    if (body.pin && body.pin.length >= 4) {
      hashedPin = await bcrypt.hash(body.pin, 10)
    }

    const employee = await db.employee.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone || '',
        role: body.role || 'staff',
        status: body.status || 'active',
        hireDate: body.hireDate ? new Date(body.hireDate) : new Date(),
        pin: hashedPin,
      },
    })

    // FIX L-07: Ustvari EmployeeJob, če je podan jobId
    if (body.jobId) {
      await db.employeeJob.create({
        data: {
          employeeId: employee.id,
          jobId: body.jobId,
          payRate: body.payRate || 0,
          isPrimary: true,
        },
      })
    }

    // Vrni brez PIN-a
    return NextResponse.json({ ...employee, pin: hashedPin ? '****' : '' })
  } catch (error) {
    console.error('Napaka pri ustvarjanju zaposlenega:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju zaposlenega' }, { status: 500 })
  }
}
