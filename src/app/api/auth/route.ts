import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { createSession, destroySession, verifyToken } from '@/lib/auth-middleware'
import { loginSchema, authResponseSchema, authStatusResponseSchema } from '@/lib/validations'
import { checkRateLimit, getClientIp, LOGIN_LIMIT } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { generateCsrfToken } from '@/lib/csrf'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// ============================================
// PIN AVTENTIKACIJA ZA POS SISTEM
// Profesionalna prijava s session managementom
// bcrypt hash + rate limiting + session tokens
// FIX MEDIUM: Uporablja skupni rate-limit.ts modul
// ============================================

// POST /api/auth — Prijava z PIN-om
export async function POST(req: Request) {
  try {
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(loginSchema, bodyResult.data)
    if (validationError) return validationError

    // Rate limiting — FIX MEDIUM: uporablja skupni rate-limit.ts modul
    const clientIp = getClientIp(req)
    const rateCheck = checkRateLimit('auth-login', clientIp, LOGIN_LIMIT)
    if (!rateCheck.allowed) {
      const retryMin = Math.ceil((rateCheck.retryAfterMs || 900000) / 60000)
      return NextResponse.json(
        { error: `Preveč neuspešnih poskusov. Poskusite znova čez ${retryMin} min.` },
        { status: 429 }
      )
    }

    // Pridobi vse aktivne zaposlene s PIN-om
    const employees = await db.employee.findMany({
      where: { status: 'active', pin: { not: '' } },
      include: {
        jobs: {
          include: { job: true },
        },
      },
    })

    // Preveri PIN z bcrypt compare (ali fallback na plaintext za stare PIN-e)
    let matchedEmployee: typeof employees[number] | null = null
    for (const emp of employees) {
      const isHashed = emp.pin.startsWith('$2')
      let pinMatches = false

      if (isHashed) {
        pinMatches = await bcrypt.compare(data.pin, emp.pin)
      } else {
        // Fallback za stare plaintext PIN-e (migracija) — timing-safe comparison (FIX H-01)
        // FIX M-04: Prepreči timing attack, ki razkrije dolžino PIN-a —
        // pad/trim oba bufferja na enako dolžino pred primerjavo
        const pinBuffer = Buffer.from(String(emp.pin))
        const inputBuffer = Buffer.from(String(data.pin))
        const maxLen = Math.max(pinBuffer.length, inputBuffer.length)
        const paddedPin = Buffer.alloc(maxLen)
        const paddedInput = Buffer.alloc(maxLen)
        pinBuffer.copy(paddedPin)
        inputBuffer.copy(paddedInput)
        pinMatches = crypto.timingSafeEqual(paddedPin, paddedInput)
        if (pinMatches) {
          const hashedPin = await bcrypt.hash(emp.pin, 10)
          await db.employee.update({
            where: { id: emp.id },
            data: { pin: hashedPin },
          })
        }
      }

      if (pinMatches) {
        matchedEmployee = emp
        break
      }
    }

    if (!matchedEmployee) {
      // FIX MEDIUM: Rate limit se samodejno šteje prek skupnega modula
      return NextResponse.json({ error: 'Napačen PIN ali nedejaven uporabnik' }, { status: 401 })
    }

    // Uspešna prijava — rate limit se naravno ponastavi po oknu

    // Pridobi dovoljenja iz vseh funkcij
    const allPermissions: string[] = []
    let primaryJob = matchedEmployee.jobs.find(j => j.isPrimary)?.job || matchedEmployee.jobs[0]?.job

    for (const ej of matchedEmployee.jobs) {
      try {
        const perms = JSON.parse(ej.job.permissions || '[]')
        allPermissions.push(...perms)
      } catch { /* ignore */ }
    }

    const permissions = [...new Set(allPermissions)]

    // Ustvari sejo z session managementom
    const token = createSession({
      id: matchedEmployee.id,
      role: matchedEmployee.role,
      permissions,
    })

    const responseData = {
      success: true,
      employee: {
        id: matchedEmployee.id,
        name: matchedEmployee.name,
        email: matchedEmployee.email,
        role: matchedEmployee.role,
        primaryJob: primaryJob ? {
          id: primaryJob.id,
          name: primaryJob.name,
          payRate: primaryJob.basePayRate,
        } : null,
        permissions,
      },
      token,
      message: `Dobrodošli, ${matchedEmployee.name}!`,
    }

    // Validiraj odziv pred vračanjem
    try {
      authResponseSchema.parse(responseData)
    } catch (validationError: unknown) {
      logger.error('API', 'Auth response validation failed:', validationError)
      return NextResponse.json({ error: 'Notranja napaka strežnika' }, { status: 500 })
    }

    return NextResponse.json(responseData)
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/auth', 'Napaka pri prijavi')
  }
}

// GET /api/auth — Preveri stanje avtentikacije (BREZ PIN podatkov!) ALI pridobi CSRF token
export async function GET(req: Request) {
  try {
    // CSRF token endpoint — GET /api/auth?csrf=1
    const url = new URL(req.url)
    if (url.searchParams.get('csrf') === '1') {
      return generateCsrfToken()
    }

    // Preveri če je uporabnik avtenticiran
    const authHeader = req.headers.get('authorization')
    let session: Awaited<ReturnType<typeof verifyToken>> | null = null
    if (authHeader?.startsWith('Bearer ')) {
      session = await verifyToken(authHeader.substring(7).trim())
    }

    // FIX HIGH: Ne razkrivaj imen zaposlenih brez avtentikacije — tveganje social engineering
    // Vrni samo število zaposlenih s PIN-om (za PIN login screen)
    const employeesWithPin = await db.employee.count({
      where: { status: 'active', pin: { not: '' } },
    })

    // SECURITY: availableRoles se vrne SAMO avtenticiranim uporabnikom
    // Neavtenticiranim uporabnikom ne razkrivamo interne strukture vlog
    let availableRoles: string[] | undefined
    if (session) {
      const roles = await db.employee.findMany({
        where: { status: 'active' },
        select: { role: true },
        distinct: ['role'],
      })
      availableRoles = roles.map(r => r.role)
    }

    const responseData = {
      authenticated: !!session,
      authEnabled: employeesWithPin > 0,
      employeesWithPin,
      ...(availableRoles && { availableRoles }),
      session: session ? {
        employeeId: session.employeeId,
        role: session.role,
        permissions: session.permissions,
      } : null,
    }

    // Validiraj odziv pred vračanjem
    try {
      authStatusResponseSchema.parse(responseData)
    } catch (validationError: unknown) {
      logger.error('API', 'Auth status response validation failed:', validationError)
      return NextResponse.json({ error: 'Notranja napaka strežnika' }, { status: 500 })
    }

    return NextResponse.json(responseData)
  } catch (error: unknown) {
    logger.error('API', 'Auth status error:', error)
    return NextResponse.json({ authEnabled: false, authenticated: false }, { status: 500 })
  }
}

// DELETE /api/auth — Odjava (uniči sejo)
export async function DELETE(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim()
      destroySession(token)
    }
    return NextResponse.json({ success: true, message: 'Uspešno odjavljeni' })
  } catch {
    return NextResponse.json({ success: true })
  }
}
