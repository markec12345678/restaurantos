import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth, revokeEmployeeSessions } from '@/lib/auth-middleware'
import { updateEmployeeSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import bcrypt from 'bcryptjs'
import { invalidateEmployeeStatusCache } from '@/lib/auth-middleware/session-store'
import { hashPinLookup, pinLookupEnabled } from '@/lib/pin-lookup'
import { WEAK_PINS, BCRYPT_ROUNDS } from '@/lib/auth-middleware/constants'


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
    // FIX IDOR (tenant scope): findUnique → findFirst z locationId scope
    // (manager lokacije A ne more urejati zaposlenih lokacije B)
    const sessionLocationId = authResult.session?.locationId ?? undefined
    const existing = await db.employee.findFirst({
      where: { id, ...(sessionLocationId ? { locationId: sessionLocationId } : {}) },
    })
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

    // P1-12: PIN hardening pri posodobitvi — 6+ mest, šibki PIN-i zavrnjeni,
    // pinLookup se POSODOBI skupaj z PIN-om (prej se je oslabil in zaposleni
    // NI VEČ MOGEL prijaviti z novim PIN-om — kritični bug), PIN se ne more
    // podvojiti pri drugem zaposlenem (409).
    let pinChanged = false
    if (data.pin !== undefined) {
      if (data.pin && !data.pin.startsWith('$2')) {
        // Šibki PIN-i (sekvence/ponovitve) se zavrnejo
        if (WEAK_PINS.has(data.pin)) {
          return NextResponse.json(
            { error: 'PIN je preveč predvidljiv (šibek). Izberite naključnejši PIN.' },
            { status: 400 }
          )
        }

        // P1-12: prepreči duplikat PIN-a (O(1) prek pinLookup; bcrypt fallback)
        if (pinLookupEnabled()) {
          const newLookup = hashPinLookup(data.pin)
          if (newLookup) {
            const duplicate = await db.employee.findFirst({
              where: { pinLookup: newLookup, status: 'active', id: { not: id } },
              select: { id: true },
            })
            if (duplicate) {
              return NextResponse.json(
                { error: 'PIN je že v uporabi pri drugem zaposlenem. Izberite drug PIN.' },
                { status: 409 }
              )
            }
          }
        }

        updateData.pin = await bcrypt.hash(data.pin, BCRYPT_ROUNDS)
        // KRITIČNI FIX: posodobi pinLookup — O(1) iskanje pri prijavi
        // uporablja pinLookup in bi drugače našlo zaposlenega po STAREM pin-u
        const newLookup = pinLookupEnabled() ? hashPinLookup(data.pin) : null
        updateData.pinLookup = newLookup || null
        pinChanged = true
      } else if (data.pin === '') {
        updateData.pin = ''
        updateData.pinLookup = null // odstrani tudi lookup (PIN je odstranjen)
        pinChanged = true
      }
      // data.pin.startsWith('$2') = obstoječi bcrypt hash poslan nazaj — ignoriraj
      // (PIN se ni spremenil; klient ne bi smel pošiljati hash-a, ampak je
      // backward-kompatibilnost varna — hash se ne zapiše kot PIN)
    }

    const employee = await db.employee.update({
      where: { id },
      data: updateData,
    })

    // ── P1-11: revokacija sej ob varnostno-relevantnih spremembah ──
    // PIN sprememba → vsi stari žetoni takoj neveljavni (kompromitiran PIN
    //   ne omogoča že ustvarjenih sej)
    // Role sprememba → permissions snapshot v seji je zastarel
    // Status sprememba (inactive/terminated) → dostop takoj prekinjen
    const roleChanged = data.role !== undefined && data.role !== existing.role
    const statusChanged = data.status !== undefined && data.status !== existing.status
    if (pinChanged || roleChanged || statusChanged) {
      const reasons: string[] = []
      if (pinChanged) reasons.push('pin')
      if (roleChanged) reasons.push('role')
      if (statusChanged) reasons.push('status')
      const reason = reasons.join('+')

      // FIX SECURITY: invalidiraj status cache (takojšen učinek statusa)
      if (statusChanged) invalidateEmployeeStatusCache(id)

      const revokedCount = await revokeEmployeeSessions(id, `employee-update:${reason}`)

      await createAuditLog({
        userId: authResult.session?.employeeId,
        action: pinChanged ? 'EMPLOYEE_PIN_CHANGED' : 'EMPLOYEE_SECURITY_UPDATE',
        entityType: 'Employee',
        entityId: id,
        details: { reason, revokedSessions: revokedCount, newRole: data.role, newStatus: data.status },
      }).catch(() => {})
    }

    // FIX SECURITY: nikoli ne vračaj `pinLookup` (HMAC) klientu — lahko bi ga
    // napadalec uporabil za offline brute-force PIN-a če pozna NEXTAUTH_SECRET.
    const { pinLookup, ...safeEmployee } = employee
    return NextResponse.json({ ...safeEmployee, pin: safeEmployee.pin ? '****' : '' })
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

    // FIX IDOR (tenant scope): terminiraj SAMO zaposlenega znotraj session lokacije
    // (manager lokacije A ne more terminirati zaposlenega lokacije B)
    const sessionLocationId = authResult.session?.locationId ?? undefined
    const existing = await db.employee.findFirst({
      where: { id, ...(sessionLocationId ? { locationId: sessionLocationId } : {}) },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Zaposleni ni najden' }, { status: 404 })
    }

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

    // P1-11: revociraj VSE seje terminiranega zaposlenega (briše DB seje +
    // poviša sessionVersion → takojšen učinek tudi na drugih instancah)
    const revokedCount = await revokeEmployeeSessions(id, 'employee-terminated')

    await createAuditLog({
      userId: authResult.session?.employeeId,
      action: 'EMPLOYEE_TERMINATED',
      entityType: 'Employee',
      entityId: id,
      details: { revokedSessions: revokedCount },
    }).catch(() => {})

    // FIX SECURITY: izloči pinLookup iz odgovora (enako kot PUT)
    const { pinLookup: _pinLookup, ...safeEmployee } = employee
    return NextResponse.json({ success: true, message: 'Zaposleni označen kot terminiran', employee: { ...safeEmployee, pin: '' } })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/employees/[id]', 'Napaka pri brisanju zaposlenega')
  }
}
