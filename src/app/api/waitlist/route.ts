// ============================================
// ČAKALNA VRSTA — Profesionalna implementacija
// Toast POS standard — Avtentikacija + varna obravnava napak
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { createWaitlistSchema } from '@/lib/validations'
import { logger } from '@/lib/logger'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za čakalno vrsto — vsebovana imena gostov, telefoni
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX R85-4a M3: Tenant scope — prej je findMany zajel vnose VSEH lokacij
    // (PII: imena in telefoni gostov vseh tenantov). Fail-closed za regularnega
    // uporabnika brez lokacije; null scope (super-admin) = globalni pogled,
    // nikoli { locationId: null } (vidi tudi legacy NULL vnose).
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/waitlist',
    })
    if ('error' in scope) return scope.error

    const entries = await db.waitlistEntry.findMany({
      where: {
        status: { in: ['waiting', 'notified'] },
        ...(scope.locationId ? { locationId: scope.locationId } : {}),
      },
      orderBy: { checkedInAt: 'asc' },
    })
    return NextResponse.json(deepToNumbers(entries))
  } catch (error: unknown) {
    logger.error('API', 'Napaka pri pridobivanju čakalne vrste:', error)
    // FIX C-08: Ne razkrivaj error.message
    return NextResponse.json({ error: 'Napaka pri pridobivanju čakalne vrste' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    // FIX C-07: Zahtevaj avtentikacijo za dodajanje v čakalno vrsto
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX H-01: Zod validacija
    const { data, error: validationError } = validateBody(createWaitlistSchema, bodyResult.data)
    if (validationError) return validationError

    // FIX IDOR-AUDIT + FIX R85-4a M3: resolver namesto raw session.locationId —
    // prej je regularni uporabnik BREZ lokacije ustvaril globalni vnos
    // (locationId null žig, viden vsem tenantom). Zdaj: 403 fail-closed;
    // lokacijski uporabnik = žig session lokacije; super-admin (null scope)
    // = NULL žig (legacy, viden samo globalnemu pogledu).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'POST /api/waitlist',
    })
    if ('error' in scope) return scope.error

    // FIX IDOR-AUDIT: zapiši locationId ob kreiranju (tenant scope iz seje)
    const entry = await db.waitlistEntry.create({
      data: {
        guestName: data.guestName,
        guestPhone: data.guestPhone || '',
        partySize: data.partySize,
        quotedWaitMinutes: data.quotedWaitMinutes || 0,
        preferredArea: data.preferredArea || '',
        specialNeeds: data.specialNeeds || '',
        status: 'waiting',
        notes: data.notes || '',
        employeeId: authResult.session?.employeeId || null,
        locationId: scope.locationId,
      },
    })
    return NextResponse.json(entry, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/waitlist', 'Napaka pri dodajanju v čakalno vrsto')
  }
}
