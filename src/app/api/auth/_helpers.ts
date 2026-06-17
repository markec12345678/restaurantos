// Pomožne funkcije za auth route — PIN verification in session creation

import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { createSession } from '@/lib/auth-middleware'
import { hashPinLookup, pinLookupEnabled } from '@/lib/pin-lookup'

export interface MatchedEmployee {
  id: string
  name: string
  email: string | null
  role: string
  pin: string
  jobs: Array<{
    isPrimary: boolean
    job: { id: string; name: string; permissions: string; basePayRate: unknown }
  }>
}

export async function verifyPin(data: { pin: string }): Promise<MatchedEmployee | null> {
  // FIX PERF: O(1) iskanje preko pinLookup (HMAC-SHA256) namesto O(n) findMany + N x bcrypt.compare.
  // Če NEXTAUTH_SECRET manjka ali zaposleni še nima pinLookup (migracija), fallback na findMany.
  if (pinLookupEnabled()) {
    const lookup = hashPinLookup(data.pin)
    if (lookup) {
      const emp = await db.employee.findUnique({
        where: { pinLookup: lookup, status: 'active' },
        include: { jobs: { include: { job: true } } },
      })
      if (emp) {
        const isHashed = emp.pin.startsWith('$2')
        // Če je PIN že bcrypt-hashan, potrdi z bcrypt.compare (defense in depth).
        // Če je plaintext (stara migracija), pinLookup že garantuje ujemanje
        // (HMAC je determinističen) — takoj migriraj na hash + pinLookup.
        if (isHashed) {
          if (await bcrypt.compare(data.pin, emp.pin)) {
            return emp as unknown as MatchedEmployee
          }
          return null // pinLookup matchal, bcrypt ne — nekonsistenca, zavrni
        }
        // Plaintext PIN — migriraj na bcrypt hash + pinLookup
        const hashedPin = await bcrypt.hash(emp.pin, 10)
        await db.employee.update({ where: { id: emp.id }, data: { pin: hashedPin, pinLookup: lookup } })
        return emp as unknown as MatchedEmployee
      }
      return null // pinLookup ni našel — PIN ni v bazi
    }
  }

  // Fallback: O(n) findMany + bcrypt.compare (za okolja brez NEXTAUTH_SECRET ali stare zaposlene)
  const employees = await db.employee.findMany({
    where: { status: 'active', pin: { not: '' } },
    include: { jobs: { include: { job: true } } },
  })

  for (const emp of employees) {
    const isHashed = emp.pin.startsWith('$2')
    let pinMatches = false

    if (isHashed) {
      pinMatches = await bcrypt.compare(data.pin, emp.pin)
    } else {
      // Fallback za stare plaintext PIN-e (migracija) — timing-safe comparison (FIX H-01)
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
        // FIX: ob migraciji zapiši tudi pinLookup za prihodnje O(1) iskanje
        await db.employee.update({
          where: { id: emp.id },
          data: { pin: hashedPin, pinLookup: hashPinLookup(emp.pin) },
        })
      }
    }

    if (pinMatches) return emp as unknown as MatchedEmployee
  }

  return null
}

// ─── Pridobi status avtentikacije ───

export async function buildAuthStatusResponse(session: Awaited<ReturnType<typeof import('@/lib/auth-middleware').verifyToken>> | null) {
  const employeesWithPin = await db.employee.count({
    where: { status: 'active', pin: { not: '' } },
  })

  let availableRoles: string[] | undefined
  if (session) {
    const roles = await db.employee.findMany({
      where: { status: 'active' },
      select: { role: true },
      distinct: ['role'],
    })
    availableRoles = roles.map(r => r.role)
  }

  return {
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
}

export async function buildAuthResponse(matchedEmployee: MatchedEmployee) {
  const allPermissions: string[] = []
  const primaryJob = matchedEmployee.jobs.find(j => j.isPrimary)?.job || matchedEmployee.jobs[0]?.job

  for (const ej of matchedEmployee.jobs) {
    try {
      const perms = JSON.parse(ej.job.permissions || '[]')
      allPermissions.push(...perms)
    } catch { /* ignore */ }
  }

  const permissions = [...new Set(allPermissions)]

  const token = await createSession({
    id: matchedEmployee.id,
    role: matchedEmployee.role,
    permissions,
  })

  return {
    success: true,
    employee: {
      id: matchedEmployee.id,
      name: matchedEmployee.name,
      email: matchedEmployee.email,
      role: matchedEmployee.role,
      primaryJob: primaryJob ? {
        id: primaryJob.id,
        name: primaryJob.name,
        payRate: Number(primaryJob.basePayRate), // FIX: Decimal → number (Zod schema pričakuje number)
      } : null,
      permissions,
    },
    token,
    message: `Dobrodošli, ${matchedEmployee.name}!`,
  }
}
