import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireAuth } from '@/lib/auth-middleware'
import { validateBody, updateEmployeeSchema } from '@/lib/validations'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const body = await req.json()

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(updateEmployeeSchema, body)
    if (validationError) return validationError

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.email !== undefined) updateData.email = data.email
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.role !== undefined) updateData.role = data.role
    if (data.status !== undefined) updateData.status = data.status
    if (data.hireDate !== undefined) updateData.hireDate = new Date(data.hireDate)

    // FIX C-04: Hash PIN pred shranjevanjem
    if (data.pin !== undefined) {
      if (data.pin && data.pin.length >= 4 && !data.pin.startsWith('$2')) {
        updateData.pin = await bcrypt.hash(data.pin, 10)
      } else if (data.pin === '') {
        updateData.pin = ''
      }
    }

    const employee = await db.employee.update({
      where: { id },
      data: updateData,
    })

    // Vrni brez PIN-a
    return NextResponse.json({ ...employee, pin: employee.pin ? '****' : '' })
  } catch (error) {
    console.error('Napaka pri posodobitvi zaposlenega:', error)
    return NextResponse.json({ error: 'Napaka pri posodobitvi zaposlenega' }, { status: 500 })
  }
}

// FIX H-07: Soft-delete namesto hard-delete (ohrani audit zgodovino)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    // Preveri, če ima zaposleni aktivne časovne vnose
    const activeTimeEntries = await db.timeEntry.count({
      where: { employeeId: id, clockOut: null },
    })

    if (activeTimeEntries > 0) {
      return NextResponse.json(
        { error: 'Zaposleni ima aktivne časovne vnose. Najprej izpišite iz ure.' },
        { status: 400 }
      )
    }

    // Soft-delete: označi kot terminiran (ne izbriši iz baze)
    const employee = await db.employee.update({
      where: { id },
      data: { status: 'terminated', pin: '' }, // Onemogoči PIN prijavo
    })

    return NextResponse.json({ success: true, message: 'Zaposleni označen kot terminiran', employee: { ...employee, pin: '' } })
  } catch (error) {
    console.error('Napaka pri brisanju zaposlenega:', error)
    return NextResponse.json({ error: 'Napaka pri brisanju zaposlenega' }, { status: 500 })
  }
}
