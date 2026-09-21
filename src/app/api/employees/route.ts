import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { createEmployeeSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError, parsePaginationParams, validateRequest } from '@/lib/api-utils'
import bcrypt from 'bcryptjs'
import { hashPinLookup, pinLookupEnabled } from '@/lib/pin-lookup'
import { WEAK_PINS, BCRYPT_ROUNDS } from '@/lib/auth-middleware/constants'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = await checkRateLimitAsync('employees', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')
    // FIX C-07: Zahtevaj avtentikacijo za seznam zaposlenih
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error
    const { searchParams } = new URL(req.url)
    const role = searchParams.get('role')
    const status = searchParams.get('status')
    // P1-16: enum validacija query filtrov — prej je neveljavna vrednost
    // (npr. ?role=hacker) povzročila PrismaClientValidationError → 500
    const VALID_ROLES = ['admin', 'manager', 'staff'] as const
    const VALID_STATUSES = ['active', 'inactive', 'terminated'] as const
    if (role && !VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
      return NextResponse.json({ error: 'Neveljavna vrednost role' }, { status: 400 })
    }
    if (status && !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      return NextResponse.json({ error: 'Neveljavna vrednost status' }, { status: 400 })
    }
    // FIX HIGH: Paginacija za zaposlene — prepreči nalaganje vseh zaposlenih z relacijami
    // P1-16: centralna pagination validacija (limit max, offset, search dolžina)
    const { limit, offset } = parsePaginationParams(searchParams)
    const where: Record<string, unknown> = {}
    // FIX Test 7.2 + R76 (centralizacija): centralni tenant scope namesto ročnega pogoja
    // (fail-open: session.locationId=null → globalni seznam zaposlenih vseh tenantov).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/employees',
    })
    if ('error' in scope) return scope.error
    if (scope.locationId) {
      where.locationId = scope.locationId
    }
    if (role) where.role = role
    // FIX MEDIUM: Privzeto izključi odpuščene zaposlene, razen če izrecno zahtevani
    if (status) {
      where.status = status
    } else {
      where.status = { not: 'terminated' }
    }
    const [employees, total] = await Promise.all([
      db.employee.findMany({
        where,
        orderBy: { name: 'asc' },
        take: limit,
        skip: offset,
        // FIX SECURITY: ne vračaj `pinLookup` (HMAC) klientu — lahko bi ga napadalec
        // uporabil za offline brute-force PIN-a če pozna NEXTAUTH_SECRET.
        // FIX PERFORMANCE: `shifts: true` je brez paginacije — za zaposlene z
        // večletno zgodovino izmen lahko vrne 1000+ vrstic. Omejimo na zadnjih 20.
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          pin: true,
          hireDate: true,
          locationId: true,
          createdAt: true,
          updatedAt: true,
          shifts: {
            orderBy: { date: 'desc' },
            take: 20,
            select: { id: true, date: true, startTime: true, endTime: true, status: true },
          },
          jobs: { include: { job: { select: { id: true, name: true, code: true } } } },
        },
      }),
      db.employee.count({ where }),
    ])
    // FIX C-06: Nikoli ne vračaj PIN-ov v odgovoru
    const safeEmployees = employees.map(emp => ({
      ...emp,
      pin: emp.pin ? '****' : '',
    }))
    return NextResponse.json({ employees: safeEmployees, total, limit, offset })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/employees', 'Napaka pri pridobivanju zaposlenih')
  }
}
export async function POST(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = await checkRateLimitAsync('employees', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')
    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error
    // R86-2b (M2 razred): scope resolver PRED vsem — prej je bil žig
    // `authResult.session?.locationId ?? null` fail-open: regular user z NULL
    // lokacijo je lahko podal body locationId (samo existence-check) in
    // ustvaril zaposlenega na TUJI lokaciji. Resolver: non-admin brez lokacije
    // → 403 fail-closed (body kandidat je sedaj dosegljiv SAMO null-scope
    // super-adminu); loc-bound seja žige VEDNO svojo lokacijo.
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'POST /api/employees',
    })
    if ('error' in scope) return scope.error
    // FIX SECURITY: validateRequest() prepreči DoS z oversized payload
    const { data, error: validationError } = await validateRequest(req, createEmployeeSchema)
    if (validationError) return validationError
    // FIX C-04 + FIX PERF: Hash PIN z bcrypt + zapiši pinLookup za O(1) iskanje
    // P1-12: 6+ mest (schema), šibki PIN-i zavrnjeni, bcrypt cost 12
    let hashedPin = ''
    let pinLookup = ''
    if (data.pin) {
      // Šibki PIN-i (sekvence/ponovitve — 123456, 111111 ...) se zavrnejo
      if (WEAK_PINS.has(data.pin)) {
        return NextResponse.json(
          { error: 'PIN je preveč predvidljiv (šibek). Izberite naključnejši PIN.' },
          { status: 400 }
        )
      }
      // FIX PERF: O(1) duplicate check preko pinLookup (prej O(n) findMany + N x bcrypt.compare)
      if (pinLookupEnabled()) {
        pinLookup = hashPinLookup(data.pin)
        const existing = await db.employee.findUnique({
          where: { pinLookup, status: 'active' },
          select: { id: true },
        })
        if (existing) {
          return NextResponse.json(
            { error: 'PIN je že v uporabi pri drugem zaposlenem. Izberite drug PIN.' },
            { status: 409 }
          )
        }
      } else {
        // Fallback: O(n) bcrypt compare (če NEXTAUTH_SECRET manjka)
        const allActive = await db.employee.findMany({
          where: { status: 'active', pin: { not: '' } },
          select: { id: true, pin: true },
        })
        for (const emp of allActive) {
          if (emp.pin && await bcrypt.compare(data.pin, emp.pin)) {
            return NextResponse.json(
              { error: 'PIN je že v uporabi pri drugem zaposlenem. Izberite drug PIN.' },
              { status: 409 }
            )
          }
        }
      }
      // P1-12: BCRYPT_ROUNDS (12) namesto 10 — ~250ms/hash
      hashedPin = await bcrypt.hash(data.pin, BCRYPT_ROUNDS)
    }
    // FIX CRITICAL: Samo admin lahko ustvari novega admin zaposlenega — prepreči privilege escalation
    // R83: 'super_admin' (platformni račun) je izjema — enako R79 webauthn matriki
    if (data.role === 'admin' && !['admin', 'super_admin'].includes(authResult.session?.role ?? '')) {
      return NextResponse.json({ error: 'Samo administrator lahko ustvari novega administratorja.' }, { status: 403 })
    }
    // R83 fix: employees POST locationId stamp — prej NIKOLI ni zapisal
    // locationId → novi zaposleni (staff/manager/kitchen) z NULL lokacijo so na
    // vseh fail-closed gate-ih (EOD, bulk-vat, qr-batch, opening-hours) dobili
    // 403 lockout, ker session.locationId izhaja iz Employee.locationId.
    //   - Lokacijsko vezan ustvarjalec → locationId VEDNO iz seje (body
    //     vrednost se ignorira — cross-tenant write ni mogoč).
    //   - Platform admin (brez lokacije) → izbirna data.locationId (validirana
    //     na obstoj) ALI role=admin brez lokacije (platformni račun, kot
    //     njegov lastni — setup/init pattern).
    //   - Platform admin + staff/manager/kitchen brez locationId → 400
    //     (fail-closed — nikoli ne ustvari razbite NULL-location accounta).
    // R86-2b: kandidat je scope.locationId (resolver-izpeljan), ne raw session.
    let newEmployeeLocationId: string | null = scope.locationId
    if (!newEmployeeLocationId) {
      const bodyLocationId = typeof data.locationId === 'string' && data.locationId.trim() ? data.locationId.trim() : null
      if (bodyLocationId) {
        const loc = await db.location.findUnique({ where: { id: bodyLocationId }, select: { id: true } })
        if (!loc) {
          return NextResponse.json({ error: 'Neveljavna lokacija (locationId ne obstaja)' }, { status: 400 })
        }
        newEmployeeLocationId = bodyLocationId
      } else if (data.role !== 'admin') {
        return NextResponse.json(
          { error: 'Zaposleni (staff/manager/kitchen) mora imeti lokacijo — podaj locationId ali uporabi račun z lokacijo.' },
          { status: 400 }
        )
      }
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
        pinLookup: pinLookup || null,
        // R83: pogojni spread — NIKOLI izrecen locationId: null write
        ...(newEmployeeLocationId ? { locationId: newEmployeeLocationId } : {}),
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
    // FIX SECURITY: izloči pinLookup iz odgovora (enako kot GET in PUT)
    const { pinLookup: _pl, ...safeEmployee } = employee
    return NextResponse.json({ ...safeEmployee, pin: hashedPin ? '****' : '' }, { status: 201 })
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json(
        { error: `Zaposleni s tem emailom že obstaja` },
        { status: 409 }
      )
    }
    logger.error('API', 'Napaka pri ustvarjanju zaposlenega:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju zaposlenega' }, { status: 500 })
  }
}
