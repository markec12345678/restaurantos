import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.email !== undefined) updateData.email = body.email
    if (body.phone !== undefined) updateData.phone = body.phone
    if (body.role !== undefined) updateData.role = body.role
    if (body.status !== undefined) updateData.status = body.status
    if (body.hireDate !== undefined) updateData.hireDate = new Date(body.hireDate)

    // FIX C-04: Hash PIN pred shranjevanjem
    if (body.pin !== undefined) {
      if (body.pin && body.pin.length >= 4 && !body.pin.startsWith('$2')) {
        updateData.pin = await bcrypt.hash(body.pin, 10)
      } else if (body.pin === '') {
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

    // Preveri, če ima zaposleni aktivne izmene ali časovne vnose
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
