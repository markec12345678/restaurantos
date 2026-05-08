import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

// ============================================
// PIN AVTENTIKACIJA ZA POS SISTEM
// Hitra prijava zaposlenih s 4-mestnim PIN-om
// FIX: PIN hasing z bcrypt + rate limiting
// ============================================

// Enostaven rate limiter v pomnilniku
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>()
const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

function checkRateLimit(ip: string): { allowed: boolean; message?: string } {
  const now = Date.now()
  const record = loginAttempts.get(ip)

  if (record && record.lockedUntil > now) {
    const remainingMin = Math.ceil((record.lockedUntil - now) / 60000)
    return { allowed: false, message: `Preveč neuspešnih poskusov. Poskusite znova čez ${remainingMin} min.` }
  }

  // Počisti potekle zapise
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
    const { pin } = body

    // Rate limiting
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const rateCheck = checkRateLimit(clientIp)
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.message }, { status: 429 })
    }

    if (!pin || pin.length < 4) {
      return NextResponse.json({ error: 'PIN mora imeti vsaj 4 števke' }, { status: 400 })
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
    let matchedEmployee = null
    for (const emp of employees) {
      const isHashed = emp.pin.startsWith('$2')
      let pinMatches = false

      if (isHashed) {
        pinMatches = await bcrypt.compare(pin, emp.pin)
      } else {
        // Fallback za stare plaintext PIN-e (migracija)
        pinMatches = emp.pin === pin
        if (pinMatches) {
          // Migriraj na bcrypt hash
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

    // Generiraj session token
    const token = crypto.randomBytes(32).toString('hex')

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

// GET /api/auth — Preveri stanje avtentikacije
export async function GET() {
  try {
    const employees = await db.employee.findMany({
      where: { status: 'active', pin: { not: '' } },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      authEnabled: employees.length > 0,
      employeesWithPin: employees.length,
      employees,
    })
  } catch (error) {
    console.error('Auth status error:', error)
    return NextResponse.json({ authEnabled: false }, { status: 500 })
  }
}
