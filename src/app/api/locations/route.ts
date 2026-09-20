// ============================================
// LOKACIJSKI API — Upravljanje več lokacij/poslovnih enot
// Multi-location podpora za verige restavracij
// ============================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import { maskLocationSecrets } from '@/lib/secret-masks'

// ============================================
// GET /api/locations — Seznam lokacij
// ============================================

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  // FIX R86-2c1 (M2): raw `session?.locationId ?? null` je bil fail-open za
  // non-admin sejo z 'admin' permissionom + NULL lokacijo (session-lifecycle
  // sprejme null za vse role) → seznam VSEH lokacij + globalna statistika.
  // Zdaj: resolver — non-admin NULL → 403 fail-closed; super-admin vse.
  const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
    endpoint: 'GET /api/locations',
  })
  if ('error' in scope) return scope.error

  try {
    const { searchParams } = new URL(req.url)
    const isActive = searchParams.get('isActive')
    const type = searchParams.get('type')
    // ISSUE #32: opcijsko filtriranje po subscription (multi-tenant SaaS)
    // OPOMBA: subscriptionId filter je varen tudi za lokacijsko vezano sejo —
    // where.id = scope.locationId se ZDAJ vedno združi (AND), tako da tuji
    // subscriptionId ne razkrije tujih lokacij (vrne samo prazno).
    const subscriptionId = searchParams.get('subscriptionId')

    const where: Record<string, unknown> = {}
    if (isActive !== null) where.isActive = isActive === 'true'
    if (type) where.type = type
    if (subscriptionId) where.subscriptionId = subscriptionId
    if (scope.locationId) where.id = scope.locationId

    const locations = await db.location.findMany({
      where,
      include: {
        _count: {
          select: {
            orders: true,
            tables: true,
            employees: true,
            inventoryItems: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // FIX SECURITY: maskiraj fursCertPassword v odgovoru
    // (prejšnja koda je vračala polno vrstico vključno z geslom certifikata)
    const _maskedLocations = locations.map(maskLocationSecrets)

    // FIX R86-2c1 (cross-tenant aggregate leak): števeci so bili VEDNO
    // globalni (db.location.count() brez filtra) — lokacijsko vezan admin je
    // videl platformno statistiko (koliko lokacij/aktivnih/odprtih je v
    // VSIH tenantov). Zdaj: scoped na svojo lokacijo; super-admin globalno.
    const statsWhere: Record<string, unknown> = scope.locationId ? { id: scope.locationId } : {}
    const totalLocations = await db.location.count({ where: statsWhere })
    const activeLocations = await db.location.count({ where: { ...statsWhere, isActive: true } })
    const openNow = await db.location.count({ where: { ...statsWhere, isOpen: true, isActive: true } })

    return NextResponse.json({
      locations: locations.map(maskLocationSecrets),
      stats: { total: totalLocations, active: activeLocations, open: openNow },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/locations', 'Napaka pri pridobivanju lokacij')
  }
}

// ============================================
// POST /api/locations — Ustvari novo lokacijo
// ============================================

const createLocationSchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(200),
  code: z.string().min(1, 'Koda je obvezna').max(20).regex(/^[A-Z0-9_-]+$/, 'Koda mora vsebovati samo velike črke, številke, _ ali -'),
  type: z.enum(['restaurant', 'food_truck', 'pop_up', 'cloud_kitchen', 'bar']).default('restaurant'),
  // ISSUE #32: SaaS tenant root — poveži z subscription (opcijsko za single-tenant)
  subscriptionId: z.string().nullable().optional(),
  address: z.string().max(500).default(''),
  city: z.string().max(200).default(''),
  postCode: z.string().max(20).default(''),
  country: z.string().max(5).default('SI'),
  phone: z.string().max(50).default(''),
  email: z.string().max(200).default(''),
  businessId: z.string().max(50).default(''),
  taxId: z.string().max(50).default(''),
  registerNumber: z.string().max(50).default(''),
  premisesId: z.string().max(50).default(''),
  fursCertPath: z.string().max(500).default(''),
  fursCertPassword: z.string().max(200).default(''),
  fursEnvironment: z.enum(['test', 'production']).default('test'),
  timezone: z.string().max(100).default('Europe/Ljubljana'),
  currency: z.string().max(5).default('EUR'),
  locale: z.string().max(10).default('sl-SI'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isActive: z.boolean().default(true),
})

export async function POST(req: Request) {
  const authResult = await requireAuth(req, { permission: 'admin' })
  if (authResult.error) return authResult.error

  // FIX R86-2c1 (M2 + subscriptionId semantika): resolver za scope; lokacijsko
  // vezan admin sme ustvariti lokacijo SAMO v svojem tenantu (subscriptionId
  // se IZPELJE iz njegove lokacije — prej je body.subscriptionId lahko
  // priklical poljuben tuj subscription → nova lokacija bi se pojavila v
  // tujem tenantu prek location.subscriptionId derivacij, npr. mobile API).
  // Admin/super-admin brez seje-lokacije sme izrecen subscriptionId (provisioning).
  const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
    endpoint: 'POST /api/locations',
  })
  if ('error' in scope) return scope.error

  try {
    const { data, error: validationError } = await validateRequest(req, createLocationSchema)
    if (validationError) return validationError

    // Preveri, da koda še ne obstaja
    const existing = await db.location.findUnique({ where: { code: data.code } })
    if (existing) {
      return NextResponse.json({ error: `Lokacija s kodo "${data.code}" že obstaja` }, { status: 409 })
    }

    // ISSUE #32: eksplicitno nastavi subscriptionId (lahko null za single-tenant)
    // FIX R86-2c1: lokacijsko vezana seja → subscriptionId VEDNO iz svoje
    // lokacije (body strip); globalna seja → izrecen body.subscriptionId.
    let subscriptionId = data.subscriptionId || null
    if (scope.locationId) {
      const own = await db.location.findUnique({
        where: { id: scope.locationId },
        select: { subscriptionId: true },
      })
      subscriptionId = own?.subscriptionId ?? null
    }

    const location = await db.location.create({
      data: {
        ...data,
        subscriptionId,
      },
    })

    // FIX SECURITY: maskiraj fursCertPassword + fursCertPath v odgovoru
    return NextResponse.json(maskLocationSecrets(location), { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/locations', 'Napaka pri ustvarjanju lokacije')
  }
}
