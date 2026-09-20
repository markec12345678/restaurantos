
// =====================================================================
// OPENING HOURS [ID] — Posodobi/izbriši posamezen dan
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { requireAuth } from '@/lib/auth-middleware'
import { isWithinScope, notInScopeResponse, resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { parseJsonBody, handleApiError, validateBody } from '@/lib/api-utils'
import { z } from 'zod'


// Zod validacija za posodobitev delovnega časa
const updateOpeningHoursSchema = z.object({
  openTime: z.string().optional(),
  closeTime: z.string().optional(),
  breakStart: z.string().nullable().optional(),
  breakEnd: z.string().nullable().optional(),
  isClosed: z.boolean().optional(),
})

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // FIX R86-2c1 (M2): raw `session?.locationId ?? null` + isWithinScope je bil
    // fail-open za non-admin sejo z NULL lokacijo (isWithinScope(null, …) = true
    // "admin cross-lokacijski nadzor") — prej je tak uporabnik lahko PATCHAL
    // delovni čas TUJE lokacije. Zdaj: resolver — non-admin NULL → 403 PRED
    // vsako poizvedbo; admin/super-admin null = globalni (nespremenjeno).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'PATCH /api/opening-hours/[id]',
    })
    if ('error' in scope) return scope.error

    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error

    const { data, error: validationError } = validateBody(updateOpeningHoursSchema, bodyResult.data)
    if (validationError) return validationError

    // FIX R82-F (LEAK-HIGH): bare update({ where: { id } }) — lokacijsko vezan
    // admin je lahko predelal delovni čas TUJE lokacije. Zdaj: fetch + scope
    // guard (canonical isWithinScope/notInScopeResponse 404, NULL fail-closed).
    const existing = await db.openingHours.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Delovni čas ni najden' }, { status: 404 })
    }
    const sessionLocId = scope.locationId
    if (!isWithinScope(sessionLocId, existing.locationId)) {
      return notInScopeResponse('Delovni čas')
    }

    const hours = await db.openingHours.update({
      where: { id },
      data: {
        ...(data.openTime !== undefined && { openTime: data.openTime }),
        ...(data.closeTime !== undefined && { closeTime: data.closeTime }),
        ...(data.breakStart !== undefined && { breakStart: data.breakStart ?? '' }),
        ...(data.breakEnd !== undefined && { breakEnd: data.breakEnd ?? '' }),
        ...(data.isClosed !== undefined && { isClosed: data.isClosed }),
      },
    })

    return NextResponse.json(deepToNumbers(hours))
  } catch (error: unknown) {
    return handleApiError(error, 'PATCH /api/opening-hours/[id]', 'Napaka pri posodabljanju')
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // FIX R86-2c1 (M2): isti resolver guard kot PATCH — non-admin NULL → 403.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'DELETE /api/opening-hours/[id]',
    })
    if ('error' in scope) return scope.error

    const { id } = await params

    // FIX R82-F (LEAK-HIGH): isti scope guard kot PATCH — prej cross-tenant
    // brisanje delovnega časa po raw ID-ju.
    const existing = await db.openingHours.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Delovni čas ni najden' }, { status: 404 })
    }
    const sessionLocId = scope.locationId
    if (!isWithinScope(sessionLocId, existing.locationId)) {
      return notInScopeResponse('Delovni čas')
    }

    await db.openingHours.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/opening-hours/[id]', 'Napaka pri brisanju')
  }
}
