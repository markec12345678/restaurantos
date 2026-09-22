// ============================================
// LOKACIJA ORDERING TOKEN ROTATE — per-location revokacija (R89)
// ============================================
// POST /api/locations/[id]/ordering-token/rotate — atomarno incrementira
// Location.tokenVersion in izda NOV token za novo verzijo. Vsi ordering
// tokeni te lokacije izdani za STARO verzijo so INSTANT neveljavni (javna
// ruta preverja token proti trenutni verziji lokacije — lib/ordering-token
// R89 kanon); tokene drugih lokacij/tenantov rotacija NE dotakne (zato ne
// rotiramo globalne ORDERING_TOKEN_SECRET skrivnosti).
//
// Zakaj SAMO permission 'admin' (za razliko od GET izdaje, ki jo sme vsak
// zaposleni): rotacija ubije OBJAVLJENO povezavo restavracije (plakat, deep
// linki, biografija) — to je write operacija nad lokacijo (zrcali
// PUT /api/locations/[id] kanon), ne vsakodnevno izdajanje. isWithinScope
// ostane za lokacijsko vezane admine (smejo rotirati SAMO svojo lokacijo);
// super-admin (null scope) ima cross-lokacijski nadzor.
//
// Atomske garancije: `tokenVersion: { increment: 1 }` (nikoli read-modify-
// write) — dva sočasna rotate-a proizvedeta dve različni verziji, vsak nov
// token je veljaven, vsi starejši so mrtvi.
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
// R92-b: enoten 429 helper — SAMOSTOJEN modul (rate-limit/response.ts),
// direkten import (ne prek barrela): barrel mocki v obstoječih testih
// (r89-token-rotate) ostanejo nedotaknjeni, oblika je vseeno identična kanonu.
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError } from '@/lib/api-utils'
import { isWithinScope, notInScopeResponse, resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { getAppUrl } from '@/lib/utils'
import { isOrderingSecretConfigured, orderingTokenFor } from '@/lib/ordering-token'

export const dynamic = 'force-dynamic'

// ============================================
// POST /api/locations/[id]/ordering-token/rotate — rotiraj token (nov URL)
// ============================================

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // R89: rotacija = write op nad lokacijo → permission 'admin' (PUT kanon);
  // regular staff NE sme ubiti objavljene povezave restavracije.
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  // R91-4: rate limit TAKOJ po requireAuth — samo avtenticirani klici trošijo
  // vedro (anonimni probe-i ne onesnažijo NAT vedra pisarne); fail-closed
  // (checkRateLimitAsync zavrača, če cache odpove — core.ts kanon).
  // Fiksni ključ 'ordering-token-rotate' (NE iz pathname): en IP ne more
  // fan-out prek različnih locationId — pathname-izpeljan ključ bi vsaki
  // lokaciji dal svoje vedro.
  const rateCheck = await checkRateLimitAsync('ordering-token-rotate', getClientIp(req), AUTHENTICATED_LIMIT)
  if (!rateCheck.allowed) {
    // 429 oblika = hišni kanon (withRateLimit HOF): Retry-After / X-RateLimit-*
    // glave, fallback 60 s, ko odgovor ne nosi retryAfterMs.
    // R92-b: enoten helper (rate-limit/response.ts) — rezultat identičen
    // prejšnjemu inline NextResponse.json bloku (refactor, ne sprememba oblike).
    return rateLimitedResponse(rateCheck.retryAfterMs)
  }

  // R89 resolver kanon: IMMEDIATELY po requireAuth, PRED param handlingom —
  // non-admin NULL-lokacijska seja → 403 fail-closed (M2 kanon).
  const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
    endpoint: 'POST /api/locations/[id]/ordering-token/rotate',
  })
  if ('error' in scope) return scope.error

  try {
    const { id } = await params

    const location = await db.location.findFirst({
      where: { id },
      select: { id: true, name: true, isActive: true, tokenVersion: true },
    })
    if (!location) {
      // Namerno 404 — ne razkrivamo obstoja tuje lokacije (isti odgovor kot
      // out-of-scope spodaj; ni obstoja-oraklja).
      return notInScopeResponse('Lokacija')
    }

    // Scope: lokacijsko vezan admin sme rotirati SAMO svojo lokacijo
    // (super-admin = null scope → cross-lokacijski nadzor, isWithinScope kanon).
    if (!isWithinScope(scope.locationId, location.id)) {
      return notInScopeResponse('Lokacija')
    }

    // R82-D kanon (zrcali izdajno GET ruto): v produkciji brez nastavljenega
    // HMAC secret-a NE rotiramo (fail-closed 503 PRED zapisom — ZERO writes).
    // Sporočilo brez notranjih detajlov.
    if (process.env.NODE_ENV === 'production' && !isOrderingSecretConfigured()) {
      return NextResponse.json(
        { error: 'Izdaja naročilnih povezav ni konfigurirana — kontaktirajte podporo' },
        { status: 503 },
      )
    }

    // ATOMIC increment (nikoli read-modify-write): stari tokeni VSEH prejšnjih
    // verzij so po tem zapisu instant neveljavni. `?? 0` guard za testne
    // fikserje brez polja (shema je NOT NULL DEFAULT 0).
    const updated = await db.location.update({
      where: { id: location.id },
      data: { tokenVersion: { increment: 1 } },
      select: { id: true, tokenVersion: true },
    })
    const newVersion = updated.tokenVersion ?? 0

    // Nov token za NOVO verzijo — isti odgovor kot izdajna GET ruta + tokenVersion.
    const token = orderingTokenFor(location.id, newVersion)
    return NextResponse.json({
      locationId: location.id,
      token,
      orderingUrl: `${getAppUrl()}/order?loc=${location.id}&t=${token}`,
      locationName: location.name,
      isActive: location.isActive,
      tokenVersion: newVersion,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/locations/[id]/ordering-token/rotate', 'Napaka pri rotaciji naročilnega tokena')
  }
}
