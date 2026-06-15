// Pomožne funkcije za auth route — PIN verification in session creation

import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { createSession } from '@/lib/auth-middleware'

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
        await db.employee.update({
          where: { id: emp.id },
          data: { pin: hashedPin },
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

export function buildAuthResponse(matchedEmployee: MatchedEmployee) {
  const allPermissions: string[] = []
  const primaryJob = matchedEmployee.jobs.find(j => j.isPrimary)?.job || matchedEmployee.jobs[0]?.job

  for (const ej of matchedEmployee.jobs) {
    try {
      const perms = JSON.parse(ej.job.permissions || '[]')
      allPermissions.push(...perms)
    } catch { /* ignore */ }
  }

  const permissions = [...new Set(allPermissions)]

  const token = createSession({
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
        payRate: primaryJob.basePayRate,
      } : null,
      permissions,
    },
    token,
    message: `Dobrodošli, ${matchedEmployee.name}!`,
  }
}
