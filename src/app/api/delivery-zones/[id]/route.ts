
// =====================================================================
// DELIVERY ZONE [ID] — Posodobi / izbriši cono dostave
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
// odstranjen prazen import (runda 12 lint cleanup)
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { z } from 'zod'
import { decimalsToNumbers } from '@/lib/decimal'
import { parseJsonBody, handleApiError } from '@/lib/api-utils'
import { isWithinScope, notInScopeResponse } from '@/lib/tenant-scope'


const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  postCodes: z.string().max(2000).optional(),
  cities: z.string().max(2000).optional(),
  radiusKm: z.number().min(0).nullable().optional(),
  centerLat: z.number().min(-90).max(90).nullable().optional(),
  centerLng: z.number().min(-180).max(180).nullable().optional(),
  deliveryFee: z.number().min(0).optional(),
  minOrderAmount: z.number().min(0).optional(),
  freeDeliveryAbove: z.number().min(0).optional(),
  estimatedMinutes: z.number().int().min(5).max(180).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  locationId: z.string().nullable().optional(),
})

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    const parsed = updateSchema.safeParse(bodyResult.data)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 })
    }

    // FIX BUG4: Check zone exists before updating — previously returned generic 500 on missing ID
    const existing = await db.deliveryZone.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Cone dostave ni mogoče najti' }, { status: 404 })
    }

    // FIX R81-F (LEAK-HIGH, cross-tenant): findUnique je bil nescopecan —
    // admin je lahko spreminjal/brisal cone TUJIH tenantov. DeliveryZone.locationId
    // je nullable — legacy NULL-location cone so fail-closed (null !== 'loc-x'),
    // super-admin (scope null) ima globalni nadzor (isWithinScope).
    // R86-2b (M2 razred): prej RAW `session?.locationId ?? null` v isWithinScope
    // — non-admin seja (permission 'admin' je permission, ne vloga) z NULL
    // lokacijo = scope null = GLOBALNI patch cone. Resolver: fail-closed 403.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'PATCH /api/delivery-zones/[id]',
    })
    if ('error' in scope) return scope.error
    if (!isWithinScope(scope.locationId, existing.locationId)) {
      return notInScopeResponse('Dostavna cona')
    }

    // FIX R81-F: PATCH schema sprejme locationId — lokacijsko vezan admin NE
    // sme preusmeriti cone na drugo lokacijo (strip, nikoli reassign);
    // super-admin sme reassign samo na NE-PRAZEN value (nastavljanje NULL
    // ni dovoljeno — legacy NULL vrstice postanejo fail-closed).
    const updateData: Record<string, unknown> = { ...parsed.data }
    if ('locationId' in updateData) {
      if (scope.locationId || !updateData.locationId) {
        delete updateData.locationId
      }
    }

    const zone = await db.deliveryZone.update({ where: { id }, data: updateData })
    return NextResponse.json(decimalsToNumbers(zone, ['deliveryFee', 'minOrderAmount', 'freeDeliveryAbove']))
  } catch (error: unknown) {
    return handleApiError(error, 'PATCH /api/delivery-zones/[id]', 'Napaka pri posodabljanju cone')
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { id } = await params
    // FIX BUG4: Check zone exists before deleting — previously returned generic 500 on missing ID
    const existing = await db.deliveryZone.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Cone dostave ni mogoče najti' }, { status: 404 })
    }

    // FIX R81-F (LEAK-HIGH, cross-tenant): isti scope check kot PATCH —
    // brisanje tuje cone je cross-tenant WRITE (NULL-location fail-closed).
    // R86-2b (M2 razred): raw `?? null` → resolver (fail-closed 403 za
    // non-admin brez lokacije; scope iz resolverja, nikoli raw session).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'DELETE /api/delivery-zones/[id]',
    })
    if ('error' in scope) return scope.error
    if (!isWithinScope(scope.locationId, existing.locationId)) {
      return notInScopeResponse('Dostavna cona')
    }

    await db.deliveryZone.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/delivery-zones/[id]', 'Napaka pri brisanju cone')
  }
}
