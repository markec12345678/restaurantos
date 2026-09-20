// ============================================
// GOST CRM — Profesionalna implementacija
// Toast POS standard — Avtentikacija + Zod validacija
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { createGuestSchema } from '@/lib/validations'
import { emitEvent } from '@/lib/event-emitter'
import { handleApiError, parsePaginationParams, validateRequest } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // FIX C-01: Zahtevaj avtentikacijo za dostop do gostov
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const vipOnly = searchParams.get('vip') === 'true'
    // FIX HIGH + P1-16: centralna pagination validacija — search max 100 znakov,
    // limit max 100 (prej 200), offset varno
    const { limit: safeLimit, offset: safeOffset, search } = parsePaginationParams(searchParams, { defaultLimit: 50 })

    // FIX R85-FINAL (HIGH): Tenant scope — prej je GET vračal celoten gost CRM
    // VSEH lokacij (imena, telefoni, e-pošta, rojstni dnevi, alergeni, VIP).
    // Guest NIMA lastnega locationId (schema backlog) — izpeljava prek order
    // zveze, enako kakor dashboard guest analytics (R85-H1) in guests/[id].
    // Fail-closed: gost brez naročil je viden samo super-adminu.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/guests',
    })
    if ('error' in scope) return scope.error

    const where: Record<string, unknown> = {}
    if (scope.locationId) {
      where.orders = { some: { locationId: scope.locationId } }
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ]
    }

    if (vipOnly) {
      where.isVip = true
    }

    const [guests, total] = await Promise.all([
      db.guest.findMany({
        where,
        include: {
          loyaltyAccount: true,
          orders: {
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: { id: true, orderNumber: true, total: true, createdAt: true, status: true }
          },
        },
        orderBy: { lastVisitAt: 'desc' },
        take: safeLimit,
        skip: safeOffset,
      }),
      db.guest.count({ where }),
    ])

    return NextResponse.json({ guests, total, limit: safeLimit, offset: safeOffset })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/guests', 'Napaka pri pridobivanju gostov')
  }
}

export async function POST(req: Request) {
  try {
    // FIX C-01: Zahtevaj avtentikacijo za ustvarjanje gosta
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX R85-FINAL: scope tudi za webhook tenant kontekst (fail-closed 403 za
    // regular uporabnika brez lokacije — enako kot GET zgoraj)
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'POST /api/guests',
    })
    if ('error' in scope) return scope.error

    // FIX SECURITY: validateRequest() prepreči DoS z oversized payload
    const { data, error: validationError } = await validateRequest(req, createGuestSchema)
    if (validationError) return validationError

    const guest = await db.guest.create({
      data: {
        firstName: data.firstName || '',
        lastName: data.lastName,
        email: data.email || '',
        phone: data.phone || '',
        isVip: data.isVip || false,
        vipSince: data.isVip ? new Date() : null,
        allergens: JSON.stringify(data.allergens || []),
        dietaryPrefs: JSON.stringify(data.dietaryPrefs || []),
        dislikes: JSON.stringify(data.dislikes || []),
        favoriteItems: JSON.stringify(data.favoriteItems || []),
        birthday: data.birthday ? new Date(data.birthday) : null,
        anniversary: data.anniversary ? new Date(data.anniversary) : null,
        company: data.company || '',
        notes: data.notes || '',
      },
      include: { loyaltyAccount: true },
    })

    // Webhook: guest.created
    // R83: Guest še nima locationId stolpca (schema runda) — tenant kontekst
    // iz scope-a klicatelja (per-location webhook matching)
    emitEvent('guest.created', {
      guestId: guest.id,
      name: `${guest.firstName} ${guest.lastName}`.trim(),
      email: guest.email,
    }, scope.locationId).catch(err => logger.error('API', '[Webhook] guest.created napaka:', err))

    return NextResponse.json(guest, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/guests', 'Napaka pri ustvarjanju gosta')
  }
}
