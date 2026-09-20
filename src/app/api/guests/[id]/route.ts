// ============================================
// GOST CRM — Posodobi / Izbriši / Pridobi
// Toast POS standard — Avtentikacija + Zod validacija
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationIdOrThrow, notInScopeResponse } from '@/lib/tenant-scope'
import { updateGuestSchema } from '@/lib/validations'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

/**
 * R87-1 (per-location CRM): skupna scope preverba za guests/[id] GET/PUT/DELETE.
 * Dovoljeno za lokacijsko vezano sejo, ČE:
 *   1. gost je žigan na to lokacijo (Guest.locationId — R87 stolpec + backfill), ALI
 *   2. gost ima vsaj eno naročilo na tej lokaciji (legacy vrstice pred
 *      backfill-om + gostje z naročili na več lokacijah).
 * Brez obeh povezav → zavrženo (klicatelj vrne unificiran 404 — ni oraklja).
 * scope.locationId === null je SAMO super-admin (resolver: regular NULL → 403
 * prej) → globalni pogled, brez omejitev (ista semantika kot isWithinScope).
 */
async function guestInScope(
  guestId: string,
  guestLocationId: string | null,
  scopeLocationId: string | null,
): Promise<boolean> {
  if (!scopeLocationId) return true // super-admin (resolver garantira)
  if (guestLocationId === scopeLocationId) return true // R87 stolpec
  // Legacy / multi-location gost: povezava prek naročila (fail-closed)
  const tie = await db.order.findFirst({
    where: { guestId, locationId: scopeLocationId },
    select: { id: true },
  })
  return tie !== null
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX C-01: Zahtevaj avtentikacijo za dostop do gosta
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX R81-F (LEAK-MEDIUM, DELNI fix — Guest NIMA tenant stolpca):
    // Guest je globalni CRM pool BY DESIGN (take_orders; dokumentirano v
    // R81-E1) — sam zapis gosta ostane dosegljiv, ampak TUJA naročila v
    // orders include so morala biti skrita. Orders include je scopcan na
    // session.locationId (Order.locationId NOT NULL). Polna tenant izolacija
    // Guest modela zahteva shematsko spremembo.
    // FIX R86-2c1 (M2): raw `session?.locationId ?? null` je bil fail-open —
    // non-admin NULL-lokacijska seja je orders include dobila PRAZEN filter
    // (naročila gosta iz VSEH tenantov). Zdaj: resolver — regular NULL → 403
    // fail-closed (sami Guest zapis ostane globalen po R81-E1 odločitvi);
    // super-admin vidi vsa naročila.
    // FIX R87-1 (polna izolacija ZAPRTA): Guest.locationId stolpec obstaja —
    // sam zapis gosta je zdaj scopcan (stolpec ALI naročilo na lokaciji,
    // zrcali GET /api/guests list). R81-E1 "globalni zapis" odločitev je
    // nadomeščena s per-location CRM (schema round) — konsistentno z listo.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'GET /api/guests/[id]',
    })
    if ('error' in scope) return scope.error
    const sessionLocId = scope.locationId

    const { id } = await params
    const guest = await db.guest.findUnique({
      where: { id },
      include: {
        loyaltyAccount: { include: { transactions: { orderBy: { createdAt: 'desc' }, take: 10 } } },
        orders: {
          // FIX R81-F: samo naročila seje-lokacije (super-admin vidi vse)
          where: { ...(sessionLocId ? { locationId: sessionLocId } : {}) },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { orderItems: { include: { menuItem: true } } },
        },
      },
    })

    if (!guest) {
      return NextResponse.json({ error: 'Gost ni najden' }, { status: 404 })
    }

    // FIX R87-1: scope preverba na samem zapisu (stolpec ALI naročilna povezava)
    if (!(await guestInScope(guest.id, guest.locationId, sessionLocId))) {
      return notInScopeResponse('Gost')
    }

    return NextResponse.json(deepToNumbers(guest))
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/guests/[id]', 'Napaka pri pridobivanju gosta')
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX C-01: Zahtevaj avtentikacijo za posodabljanje gosta
    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // FIX R87-1 (HIGH cross-tenant PII update — zaprt): prej je bil PUT
    // NEscopčan (kateri koli take_orders staff je smel posodobiti PII gosta
    // KATEREGA KOLI tenanta — ime, email, telefon, alergeni!). "R82: Guest
    // .locationId schema round" nota je čakala na ta stolpec. Zdaj: resolver
    // TAKOJ za requireAuth (pred body parse — kanon R86), scope preverba na
    // zapisu (stolpec ALI naročilna povezava) pred update-om.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'PUT /api/guests/[id]',
    })
    if ('error' in scope) return scope.error
    const sessionLocId = scope.locationId

    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    // FIX C-04: Zod validacija namesto ročnega beleženja polj
    const { data, error: validationError } = validateBody(updateGuestSchema, bodyResult.data)
    if (validationError) return validationError

    // Preveri, da gost obstaja
    const existing = await db.guest.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Gost ni najden' }, { status: 404 })
    }

    // FIX R87-1: scope preverba (stolpec ALI naročilna povezava) — cross-tenant
    // update → unificiran 404 (ni oraklja: isti odgovor kot neobstoječ gost)
    if (!(await guestInScope(existing.id, existing.locationId, sessionLocId))) {
      return notInScopeResponse('Gost')
    }

    const updateData: Record<string, unknown> = {}

    if (data.firstName !== undefined) updateData.firstName = data.firstName
    if (data.lastName !== undefined) updateData.lastName = data.lastName
    if (data.email !== undefined) updateData.email = data.email
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.isVip !== undefined) {
      updateData.isVip = data.isVip
      if (data.isVip && !existing.isVip) updateData.vipSince = new Date()
    }
    if (data.allergens !== undefined) updateData.allergens = JSON.stringify(data.allergens)
    if (data.dietaryPrefs !== undefined) updateData.dietaryPrefs = JSON.stringify(data.dietaryPrefs)
    if (data.dislikes !== undefined) updateData.dislikes = JSON.stringify(data.dislikes)
    if (data.favoriteItems !== undefined) updateData.favoriteItems = JSON.stringify(data.favoriteItems)
    if (data.birthday !== undefined) updateData.birthday = data.birthday ? new Date(data.birthday) : null
    if (data.anniversary !== undefined) updateData.anniversary = data.anniversary ? new Date(data.anniversary) : null
    if (data.company !== undefined) updateData.company = data.company
    if (data.notes !== undefined) updateData.notes = data.notes

    const guest = await db.guest.update({
      where: { id },
      data: updateData,
      include: { loyaltyAccount: true },
    })

    return NextResponse.json(deepToNumbers(guest))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/guests/[id]', 'Napaka pri posodabljanju gosta')
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // FIX C-01: Zahtevaj avtentikacijo za brisanje gosta
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // FIX R87-1 (HIGH cross-tenant PII anonymize — zaprt): prej je bil DELETE
    // NEscopčan (kateri koli 'admin'-permission staff je smel anonimizirati
    // gosta KATEREGA KOLI tenanta — GDPR pravica do izbrisa na tujem CRM-ju!).
    // Zdaj: resolver TAKOJ za requireAuth + scope preverba na zapisu.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'DELETE /api/guests/[id]',
    })
    if ('error' in scope) return scope.error
    const sessionLocId = scope.locationId

    const { id } = await params

    const existing = await db.guest.findUnique({
      where: { id },
      include: { orders: { select: { id: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Gost ni najden' }, { status: 404 })
    }

    // FIX R87-1: scope preverba (stolpec ALI naročilna povezava) — cross-tenant
    // anonymize → unificiran 404 (ni oraklja)
    if (!(await guestInScope(existing.id, existing.locationId, sessionLocId))) {
      return notInScopeResponse('Gost')
    }

    // FIX HIGH: Prepreči hard-delete — uporabi soft-delete (anonymize PII)
    // Če ima gost naročila, ne smemo izbrisati (FK constraints + GDPR evidence)
    if (existing.orders.length > 0) {
      return NextResponse.json(
        { error: 'Gost ima obstoječa naročila in ne more biti izbrisan. Anonimizirajte namesto tega.' },
        { status: 400 }
      )
    }

    // Soft-delete: anonymize PII, ohrani zapis za referenco
    // FIX HIGH: Anonimiziraj TUDI JSON PII polja (allergens, dietaryPrefs, dislikes, favoriteItems)
    // Prejšnja koda je pustila osebne preference — kršitev GDPR (pravica do izbrisa)
    await db.guest.update({
      where: { id },
      data: {
        firstName: '[Izbrisano]',
        lastName: '[Izbrisano]',
        email: '',
        phone: '',
        notes: '',
        company: '',
        birthday: null,
        anniversary: null,
        allergens: '[]',
        dietaryPrefs: '[]',
        dislikes: '[]',
        favoriteItems: '[]',
      },
    })

    return NextResponse.json({ success: true, message: 'Gost anonimiziran' })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/guests/[id]', 'Napaka pri brisanju gosta')
  }
}
