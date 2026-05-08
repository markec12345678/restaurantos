import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const employee = await db.employee.update({
    where: { id },
    data: {
      name: body.name,
      email: body.email,
      phone: body.phone,
      role: body.role,
      status: body.status,
      hireDate: body.hireDate ? new Date(body.hireDate) : undefined,
    },
  })
  return NextResponse.json(employee)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.shift.deleteMany({ where: { employeeId: id } })
  await db.employee.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
