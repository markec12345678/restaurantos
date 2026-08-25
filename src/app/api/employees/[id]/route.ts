import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { updateEmployeeSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import bcrypt from 'bcryptjs'
import { invalidateEmployeeStatusCache } from '@/lib/auth-middleware/session-store'


export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX H-01: Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(updateEmployeeSchema, bodyResult.data)
    if (validationError) return validationError

    // FIX HIGH: Preveri, da zaposleni obstaja pred posodobitvijo
    const existing = await db.employee.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Zaposleni ni najden' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.email !== undefined) updateData.email = data.email
    if (data.phone !== undefined) updateData.phone = data.phone

    // FIX CRITICAL: Samo admin lahko spremeni role na 'admin' — prepreči privilege escalation
    // Manager ne sme povišati nikogar (tudi sebe) na admin
    if (data.role !== undefined) {
      if (data.role === 'admin' && authResult.session?.role !== 'admin') {
        return NextResponse.json({ error: 'Samo administrator lahko dodeli admin vlogo.' }, { status: 403 })
      }
      // FIX CRITICAL: Manager ne sme spremeniti role admina — prepreči demotion zaščite
      if (existing.role === 'admin' && authResult.session?.role !== 'admin') {
        return NextResponse.json({ error: 'Samo administrator lahko spremeni vlogo administratorja.' }, { status: 403 })
      }
      updateData.role = data.role
    }

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

    // FIX SECURITY: invalidiraj status cache če se je status spremenil
    // (terminiran zaposleni ne sme več dostopati do API-jev)
    if (data.status !== undefined && data.status !== existing.status) {
      invalidateEmployeeStatusCache(id)
    }

    // Vrni brez PIN-a
    return NextResponse.json({ ...employee, pin: employee.pin ? '****' : '' })
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/employees/[id]', 'Napaka pri posodobitvi zaposlenega')
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
      data: { status: 'terminated', pin: '', pinLookup: null }, // Onemogoči PIN prijavo (počisti tudi pinLookup)
    })

    // FIX SECURITY: invalidiraj status cache — terminiran zaposleni ne sme
    // več dostopati do API-jev z obstoječo sejo (ki je še veljavna do 8h).
    invalidateEmployeeStatusCache(id)

    return NextResponse.json({ success: true, message: 'Zaposleni označen kot terminiran', employee: { ...employee, pin: '' } })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/employees/[id]', 'Napaka pri brisanju zaposlenega')
  }
}
