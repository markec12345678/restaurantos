// ============================================
// POST /api/push/subscribe — Registriraj push subscription
// DELETE /api/push/subscribe — Odjavi push subscription
// ============================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, parseJsonBody } from '@/lib/api-utils'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().optional(),
})

// POST — registriraj novo subscripcijo
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error } = subscribeSchema.safeParse(bodyResult.data)
    if (error) {
      return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 })
    }

    const employeeId = authResult.session?.employeeId
    if (!employeeId) {
      return NextResponse.json({ error: 'Ni employee ID' }, { status: 400 })
    }

    // Preveri ali že obstaja (idempotentno)
    const existing = await db.pushSubscription.findFirst({
      where: { endpoint: data.endpoint, employeeId },
    })

    if (existing) {
      // Posodobi keys (se lahko spremenijo)
      await db.pushSubscription.update({
        where: { id: existing.id },
        data: {
          p256dhKey: data.keys.p256dh,
          authKey: data.keys.auth,
          userAgent: data.userAgent || existing.userAgent,
          updatedAt: new Date(),
        },
      })
      return NextResponse.json({ success: true, message: 'Subscripcija posodobljena' })
    }

    // Ustvari novo
    await db.pushSubscription.create({
      data: {
        employeeId,
        endpoint: data.endpoint,
        p256dhKey: data.keys.p256dh,
        authKey: data.keys.auth,
        userAgent: data.userAgent || '',
      },
    })

    logger.info('PUSH', `Nova push subscripcija za ${employeeId}`)
    return NextResponse.json({ success: true, message: 'Subscripcija registrirana' }, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/push/subscribe', 'Napaka pri registraciji push subscripcije')
  }
}

// DELETE — odjavi subscripcijo
export async function DELETE(req: Request) {
  try {
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const endpoint = searchParams.get('endpoint')

    if (!endpoint) {
      return NextResponse.json({ error: 'Manjka endpoint parameter' }, { status: 400 })
    }

    await db.pushSubscription.deleteMany({
      where: {
        endpoint,
        employeeId: authResult.session?.employeeId || undefined,
      },
    })

    return NextResponse.json({ success: true, message: 'Subscripcija odjavljena' })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/push/subscribe', 'Napaka pri odjavi push subscripcije')
  }
}
