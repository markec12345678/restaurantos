// ============================================
// POST /api/setup/super-admin
// ============================================
// Ustvari super-admin uporabnika z začasnim PIN-om 482917.
// Super-admin ima:
//   - role: 'admin'
//   - locationId: null (vidi vse lokacije)
//   - permissions: ['admin']
//
// Varnost (P1-12 fix, v1.0.12):
//   - PREJ: endpoint je OBSTOJEČEGA super-admina RESETIRAL na znani PIN
//     5555 — kdorkoli je lahko poklical POST in prevzel admin dostop (backdoor)
//   - SEDAJ: če super-admin že obstaja → 409 (brez resetiranja PIN-a)
//   - PIN 482917: 6 mest, ni v WEAK_PINS seznamu (login dopušča kakršen koli)
//   - bcrypt cost 12 (BCRYPT_ROUNDS)
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { hashPinLookup } from '@/lib/pin-lookup'
import { logger } from '@/lib/logger'
import { checkRateLimitAsync, getClientIp, SEED_LIMIT } from '@/lib/rate-limit'
import { BCRYPT_ROUNDS } from '@/lib/auth-middleware/constants'

export const dynamic = 'force-dynamic'

const SUPER_ADMIN_PIN = '482917'

export async function POST(req: Request) {
  try {
    // FIX Code Review: Rate limiting — prepreči zlorabo
    const ip = getClientIp(req)
    const rl = await checkRateLimitAsync('setup-super-admin', ip, SEED_LIMIT)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Preveč zahtevkov. Poskusite znova kasneje.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs || 3600000) / 1000)) } }
      )
    }

    // Preveri ali super-admin že obstaja
    const existing = await db.employee.findFirst({
      where: {
        OR: [
          { email: 'superadmin@restaurantos.local' },
          { name: 'Super Admin' },
        ],
      },
    })

    // P1-12 SECURITY FIX: NIKOLI ne resetiraj PIN-a obstoječega super-admina
    // prek javnega endpoint-a — to bi bil backdoor (kdorkoli pokliče POST in
    // prijava z znanim PIN-om = prevzem admin dostopa). Samo kreacija ob
    // prvi namestitvi.
    if (existing) {
      logger.warn('SETUP', `Zavrnjen poskus resetiranja super-admin PIN-a (IP: ${ip})`)
      return NextResponse.json(
        { error: 'Super-admin že obstaja. PIN spremenite prek admin vmesnika (Zaposleni).' },
        { status: 409 }
      )
    }

    // Ustvari novega super-admin (samo prva namestitev)
    const hashedPin = await bcrypt.hash(SUPER_ADMIN_PIN, BCRYPT_ROUNDS)
    const pinLookup = hashPinLookup(SUPER_ADMIN_PIN)
    const superAdmin = await db.employee.create({
      data: {
        name: 'Super Admin',
        email: 'superadmin@restaurantos.local',
        pin: hashedPin,
        ...(pinLookup ? { pinLookup } : {}),
        role: 'admin',
        status: 'active',
        locationId: null, // null = vidi vse lokacije
      },
    })

    // Dodaj admin job
    const adminJob = await db.job.upsert({
      where: { name: 'Administrator' },
      create: {
        name: 'Administrator',
        permissions: JSON.stringify(['admin']),
        basePayRate: 0,
      },
      update: {},
    })

    await db.employeeJob.create({
      data: {
        employeeId: superAdmin.id,
        jobId: adminJob.id,
        isPrimary: true,
      },
    }).catch(() => {}) // Ignore if already exists

    logger.info('SETUP', `Super-admin created: ${superAdmin.id} (začasni PIN — spremenite po prvi prijavi)`)

    return NextResponse.json({
      success: true,
      message: 'Super-admin ustvarjen z začasnim PIN-om 482917 — SPREMENITE GA po prvi prijavi',
      employeeId: superAdmin.id,
      alreadyExisted: false,
    })
  } catch (error: unknown) {
    logger.error('SETUP', 'Failed to create super-admin:', error)
    return NextResponse.json(
      { error: 'Napaka pri ustvarjanju super-admin' },
      { status: 500 }
    )
  }
}
