import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { createEmployeeSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import bcrypt from 'bcryptjs'
import { hashPinLookup, pinLookupEnabled } from '@/lib/pin-lookup'
export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja
    const rl = checkRateLimit('employees', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })
    // FIX C-07: Zahtevaj avtentikacijo za seznam zaposlenih
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error
    const { searchParams } = new URL(req.url)
    const role = searchParams.get('role')
    const status = searchParams.get('status')
    // FIX HIGH: Paginacija za zaposlene — prepreči nalaganje vseh zaposlenih z relacijami
    const rawLimit = parseInt(searchParams.get('limit') || '100')
    const rawOffset = parseInt(searchParams.get('offset') || '0')
    const limit = Math.min(Number.isNaN(rawLimit) ? 100 : rawLimit, 500)
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset
    const where: Record<string, unknown> = {}
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
        include: { shifts: true, jobs: { include: { job: true } } },
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
    const rl = checkRateLimit('employees', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return NextResponse.json({ error: 'Preveč zahtevkov' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } })
    // FIX C-05: Zahtevaj avtentikacijo
    const authResult = await requireAuth(req, { permission: 'manage_employees' })
    if (authResult.error) return authResult.error
    // FIX SECURITY: validateRequest() prepreči DoS z oversized payload
    const { data, error: validationError } = await validateRequest(req, createEmployeeSchema)
    if (validationError) return validationError
    // FIX C-04 + FIX PERF: Hash PIN z bcrypt + zapiši pinLookup za O(1) iskanje
    let hashedPin = ''
    let pinLookup = ''
    if (data.pin && data.pin.length >= 4) {
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
      hashedPin = await bcrypt.hash(data.pin, 10)
    }
    // FIX CRITICAL: Samo admin lahko ustvari novega admin zaposlenega — prepreči privilege escalation
    if (data.role === 'admin' && authResult.session?.role !== 'admin') {
      return NextResponse.json({ error: 'Samo administrator lahko ustvari novega administratorja.' }, { status: 403 })
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
