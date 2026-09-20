// ============================================
// RUNDA 69: /api/happy-hour/[id] — PATCH (toggle aktivnosti) + DELETE
// Prej: route sploh ni obstajal → toggle in izbris v HappyHourTab sta bila
// TICHA LAŽNA USPEHA (Next je vrnil 200 + HTML not-found stran; client je
// videl res.ok → toast "Izbrisano", ampak se NIČ ni izbrisalo). Poleg tega
// UI delete ni imel potrditvenega dialoga (nevaren instant delete).
// HappyHourSchedule je leaf model (vhodne FK: ne obstajajo; priceGroup je
// STARŠ z Cascade) → hard delete je varen po obstoječem checku.
// ============================================
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { happyHourStatusSchema } from '@/lib/validations'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { isWithinScope, notInScopeResponse } from '@/lib/tenant-scope'

export const dynamic = 'force-dynamic'

// FIX R81-F (LEAK-HIGH): inline role-aware fail-closed gate (zrcali
// resolveCatalogScope semantiko; subscription platformAdminGate stil — brez
// tenant-scope helperjev). Non-admin BREZ session.locationId = 403.
function requireHappyHourLocationScope(
  authResult: { session?: { role?: string; locationId?: string | null } | null },
): { sessionLocId: string | null } | { error: NextResponse } {
  const session = authResult.session
  const sessionLocId = session?.locationId ?? null
  const isRoleAdmin = session?.role === 'admin' || session?.role === 'super_admin'
  if (!sessionLocId && !isRoleAdmin) {
    return {
      error: NextResponse.json(
        { error: 'Vaš račun nima dodeljene lokacije. Kontaktirajte administratorja.' },
        { status: 403 },
      ),
    }
  }
  return { sessionLocId }
}

// PATCH /api/happy-hour/[id] — preklop isActive (toggle stikalo v UI)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error
    // FIX R81-F: scope gate
    const scope = requireHappyHourLocationScope(authResult)
    if ('error' in scope) return scope.error
    const sessionLocId = scope.sessionLocId

    const { id } = await params
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    const { data, error: validationError } = validateBody(happyHourStatusSchema, bodyResult.data)
    if (validationError) return validationError
    const existing = await db.happyHourSchedule.findUnique({
      where: { id },
      // FIX R81-F: include starša priceGroup za scope izpeljavo
      // (HappyHourSchedule nima lastnega locationId).
      include: { priceGroup: { select: { locationId: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Happy Hour urnik ni najden' }, { status: 404 })
    }
    // FIX R81-F (LEAK-HIGH, cross-tenant): findUnique je bil brez preverjanja
    // priceGroup.locationId — admin je lahko preklapljal urnike TUJIH tenantov
    // (tuj cenik → tuj popust). isWithinScope: super-admin (null) globalen.
    if (!isWithinScope(sessionLocId, existing.priceGroup.locationId)) {
      return notInScopeResponse('Happy ura')
    }
    const updated = await db.happyHourSchedule.update({
      where: { id },
      data: { isActive: data.isActive },
      include: { priceGroup: true },
    })
    return NextResponse.json(updated)
  } catch (error: unknown) {
    return handleApiError(error, 'PATCH /api/happy-hour/[id]', 'Napaka pri preklopu Happy Hour urnika')
  }
}

// DELETE /api/happy-hour/[id] — izbris urnika (leaf → varen hard delete)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error
    // FIX R81-F: scope gate
    const scope = requireHappyHourLocationScope(authResult)
    if ('error' in scope) return scope.error
    const sessionLocId = scope.sessionLocId

    const { id } = await params
    const existing = await db.happyHourSchedule.findUnique({
      where: { id },
      // FIX R81-F: include starša priceGroup za scope izpeljavo
      include: { priceGroup: { select: { locationId: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Happy Hour urnik ni najden' }, { status: 404 })
    }
    // FIX R81-F (LEAK-HIGH, cross-tenant): isti scope check kot PATCH —
    // brisanje tujega urnika je cross-tenant WRITE.
    if (!isWithinScope(sessionLocId, existing.priceGroup.locationId)) {
      return notInScopeResponse('Happy ura')
    }
    await db.happyHourSchedule.delete({ where: { id } })
    return NextResponse.json({ ok: true, id })
  } catch (error: unknown) {
    return handleApiError(error, 'DELETE /api/happy-hour/[id]', 'Napaka pri brisanju Happy Hour urnika')
  }
}
