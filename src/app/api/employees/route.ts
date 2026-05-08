import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const employees = await db.employee.findMany({
    orderBy: { name: 'asc' },
    include: { shifts: true },
  })
  return NextResponse.json(employees)
}

export async function POST(req: Request) {
  const body = await req.json()
  const employee = await db.employee.create({
    data: {
      name: body.name,
      email: body.email,
      phone: body.phone || '',
      role: body.role || 'staff',
      status: body.status || 'active',
      hireDate: body.hireDate ? new Date(body.hireDate) : new Date(),
    },
  })
  return NextResponse.json(employee)
}
