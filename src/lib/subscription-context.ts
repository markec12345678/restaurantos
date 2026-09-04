// ============================================
// SUBSCRIPTION CONTEXT — Multi-tenant SaaS helper
//
// ISSUE #32: Skupne helper funkcije za delo s subscriptionId.
//
// V single-tenant deploy-u (1 subscription ali brez): vse poizvedbe so nespremenjene.
// V multi-tenant deploy-u: admin/manager vidijo samo svoje lokacije in podatke.
//
// Uporaba v API rutah:
//   const ctx = await getSubscriptionContext(req)
//   if (ctx.error) return ctx.error
//   const where = ctx.locationFilter() // { subscriptionId: 'sub_xxx' } ali {}
//   const locations = await db.location.findMany({ where })
// ============================================

import { db } from '@/lib/db'
import { requireAuth, type Session } from '@/lib/auth-middleware'
import { NextResponse } from 'next/server'

export interface SubscriptionContext {
  /** Trenutna seja uporabnika */
  session: Session
  /** Subscription ID trenutnega tenant-a (lahko null za single-tenant deploy) */
  subscriptionId: string | null
  /** Pravilen where filter za poizvedbe po Location */
  locationFilter: () => { subscriptionId?: string }
  /** Ali je uporabnik v multi-tenant načinu (ima subscription) */
  isMultiTenant: boolean
  /** Napaka (če je) */
  error: NextResponse | null
}

/**
 * Pridobi subscription kontekst iz zahtevka.
 *
 * Logika:
 * 1. requireAuth — uporabnik mora biti prijavljen
 * 2. Poišči aktivno subscription (trial/active/past_due) v bazi
 * 3. Če obstaja → multi-tenant način (filter po subscriptionId)
 * 4. Če ne obstaja → single-tenant način (brez filtra)
 *
 * V prihodnosti: branje subscriptionId iz session.employee.subscriptionId
 * (ko Employee model dobi subscriptionId polje).
 */
export async function getSubscriptionContext(
  req: Request,
  options?: { permission?: Parameters<typeof requireAuth>[1] extends { permission?: infer P } ? P : never },
): Promise<SubscriptionContext> {
  const authResult = await requireAuth(req, options as never)
  if (authResult.error || !authResult.session) {
    return {
      session: null as unknown as Session,
      subscriptionId: null,
      locationFilter: () => ({}),
      isMultiTenant: false,
      error: authResult.error || NextResponse.json({ error: 'Neavtenticiran' }, { status: 401 }),
    }
  }

  const session = authResult.session

  // Poišči trenutno subscription (prva aktivna/trial/past_due, zadnja ustvarjena)
  // V multi-tenant bodoče: preberemo subscriptionId iz session.employee.subscriptionId
  const subscription = await db.subscription.findFirst({
    where: { status: { in: ['trial', 'active', 'past_due'] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })

  const subscriptionId = subscription?.id || null
  const isMultiTenant = subscriptionId !== null

  return {
    session,
    subscriptionId,
    isMultiTenant,
    locationFilter: () => (subscriptionId ? { subscriptionId } : {}),
    error: null,
  }
}

/**
 * Preveri ali lokacija pripada trenutnemu subscription-u.
 *
 * Uporaba v API rutah ko uporabnik dostopa do /api/locations/[id]/...:
 *   const ctx = await getSubscriptionContext(req)
 *   const ok = await canAccessLocation(ctx, locationId)
 *   if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
 */
export async function canAccessLocation(
  ctx: SubscriptionContext,
  locationId: string,
): Promise<boolean> {
  // Single-tenant: vse lokacije so dostopne
  if (!ctx.isMultiTenant) return true

  const location = await db.location.findUnique({
    where: { id: locationId },
    select: { subscriptionId: true },
  })

  if (!location) return false
  return location.subscriptionId === ctx.subscriptionId
}

/**
 * Pridobi vse location IDs za trenutni subscription.
 *
 * Uporaba v API rutah ko moramo filtrirati po več lokacijah hkrati:
 *   const ctx = await getSubscriptionContext(req)
 *   const locationIds = await getLocationIdsForSubscription(ctx)
 *   const orders = await db.order.findMany({ where: { locationId: { in: locationIds } } })
 */
export async function getLocationIdsForSubscription(
  ctx: SubscriptionContext,
): Promise<string[] | undefined> {
  if (!ctx.isMultiTenant || !ctx.subscriptionId) return undefined

  const locations = await db.location.findMany({
    where: { subscriptionId: ctx.subscriptionId },
    select: { id: true },
  })

  return locations.map((l) => l.id)
}
