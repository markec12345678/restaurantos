import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { createSession, destroySession, verifyToken } from '@/lib/auth-middleware'
import { validateBody, loginSchema } from '@/lib/validations'

// ============================================
// PIN AVTENTIKACIJA ZA POS SISTEM
// Profesionalna prijava s session managementom
// bcrypt hash + rate limiting + session tokens
// ============================================

// Enostaven rate limiter v pomnilniku
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>()
const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

// Periodično čiščenje poteklih rate limit vnosov (vsakih 10 minut)
setInterval(() => {
  const now = Date.now()
  for (const [ip, record] of loginAttempts) {
    if (record.lockedUntil <= now) {
      loginAttempts.delete(ip)
    }
  }
}, 10 * 60 * 1000)

function checkRateLimit(ip: string): { allowed: boolean; message?: string } {
  const now = Date.now()
  const record = loginAttempts.get(ip)

  if (record && record.lockedUntil > now) {
    const remainingMin = Math.ceil((record.lockedUntil - now) / 60000)
    return { allowed: false, message: `Preveč neuspešnih poskusov. Poskusite znova čez ${remainingMin} min.` }
  }

  if (record && record.lockedUntil <= now) {
    loginAttempts.delete(ip)
  }

  return { allowed: true }
}

function recordFailedAttempt(ip: string) {
  const now = Date.now()
  const record = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 }
  record.count++

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MINUTES * 60 * 1000
    record.count = 0
  }

  loginAttempts.set(ip, record)
}

function clearFailedAttempts(ip: string) {
  loginAttempts.delete(ip)
}

// POST /api/auth — Prijava z PIN-om
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Validiraj vnos z Zod
    const { data, error: validationError } = validateBody(loginSchema, body)
    if (validationError) return validationError

    // Rate limiting
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const rateCheck = checkRateLimit(clientIp)
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.message }, { status: 429 })
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
        const pinBuffer = Buffer.from(String(emp.pin))
        const inputBuffer = Buffer.from(String(data.pin))
        if (pinBuffer.length !== inputBuffer.length) {
          // Still do a comparison to maintain constant time
          crypto.timingSafeEqual(pinBuffer, pinBuffer)
          pinMatches = false
        } else {
          pinMatches = crypto.timingSafeEqual(pinBuffer, inputBuffer)
        }
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
      recordFailedAttempt(clientIp)
      return NextResponse.json({ error: 'Napačen PIN ali nedejaven uporabnik' }, { status: 401 })
    }

    // Uspešna prijava — počisti rate limit
    clearFailedAttempts(clientIp)

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

    return NextResponse.json({
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
    })
  } catch (error) {
    console.error('Auth login error:', error)
    return NextResponse.json({ error: 'Napaka pri prijavi' }, { status: 500 })
  }
}

// GET /api/auth — Preveri stanje avtentikacije (BREZ PIN podatkov!)
export async function GET(req: Request) {
  try {
    // Preveri če je uporabnik avtenticiran
    const authHeader = req.headers.get('authorization')
    let session: Awaited<ReturnType<typeof verifyToken>> | null = null
    if (authHeader?.startsWith('Bearer ')) {
      session = verifyToken(authHeader.substring(7).trim())
    }

    // Vrni samo osnovne informacije o zaposlenih — NIKOLI PIN-ov
    const employees = await db.employee.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      authenticated: !!session,
      authEnabled: employees.length > 0,
      employeesWithPin: employees.length,
      employees: employees.map(e => ({
        id: e.id,
        name: e.name,
        role: e.role,
      })),
      session: session ? {
        employeeId: session.employeeId,
        role: session.role,
        permissions: session.permissions,
      } : null,
    })
  } catch (error) {
    console.error('Auth status error:', error)
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
  } catch (error) {
    return NextResponse.json({ success: true })
  }
}
