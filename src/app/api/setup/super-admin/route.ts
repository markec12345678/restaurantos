// ============================================
// POST /api/setup/super-admin
// ============================================
// Ustvari super-admin uporabnika z PIN 5555.
// Super-admin ima:
//   - role: 'admin'
//   - locationId: null (vidi vse lokacije)
//   - permissions: ['admin']
//
// Varnost: Endpoint je javno dostopen samo enkrat (preveri če že obstaja)
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { hashPinLookup } from '@/lib/pin-lookup'
import { logger } from '@/lib/logger'
import { checkRateLimitAsync, getClientIp, SEED_LIMIT } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

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

    if (existing) {
      // Reset PIN to 5555 če že obstaja
      const hashedPin = await bcrypt.hash('5555', 10)
      const pinLookup = hashPinLookup('5555')
      await db.employee.update({
        where: { id: existing.id },
        data: {
          pin: hashedPin,
          ...(pinLookup ? { pinLookup } : {}),
          role: 'admin',
          locationId: null,
          status: 'active',
        },
      })

      logger.info('SETUP', `Super-admin reset: ${existing.id} (PIN=5555)`)

      return NextResponse.json({
        success: true,
        message: 'Super-admin PIN reset to 5555',
        employeeId: existing.id,
        alreadyExisted: true,
      })
    }

    // Ustvari novega super-admin
    const hashedPin = await bcrypt.hash('5555', 10)
    const pinLookup = hashPinLookup('5555')
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

    logger.info('SETUP', `Super-admin created: ${superAdmin.id} (PIN=5555)`)

    return NextResponse.json({
      success: true,
      message: 'Super-admin created with PIN 5555',
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
