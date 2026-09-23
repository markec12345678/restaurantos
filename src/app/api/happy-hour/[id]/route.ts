// ============================================
// RUNDA 69: /api/happy-hour/[id] — PATCH (toggle aktivnosti) + DELETE
// Prej: route sploh ni obstajal → toggle in izbris v HappyHourTab sta bila
// TICHA LAŽNA USPEHA (Next je vrnil 200 + HTML not-found stran; client je
// videl res.ok → toast "Izbrisano", ampak se NIČ ni izbrisalo). Poleg tega
// UI delete ni imel potrditvenega dialoga (nevaren instant delete).
// HappyHourSchedule je leaf model (vhodne FK: ne obstajajo; priceGroup je
// STARŠ z Cascade) → hard delete je varen po obstoječem checku.
// ============================================
import { Prisma } from '@prisma/client'
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
    // FIX R112 (HH-2, LOW — stale read + unconditional write, TOCTOU razred iz
    // R100–R111): prej je bil NEPOGOJEN update({ where: { id }, data }) — tekma
    // z DELETE med preberi in piši = P2025 → 500; dvojni toggle = neskončno
    // utripanje stikala (last-writer-wins brez korelacije z realnim stanjem).
    // Fix: CAS toggle updateMany({ where: { id, isActive: !newValue },
    // data: { isActive: newValue } }) — prijel samo, če je bila vrednost v
    // trenutku pisanja obrnjena:
    //   count 0 → re-check obstoja: izbrisana → 404 'Happy ura ne obstaja';
    //   še vedno tam (že v želenem stanju — dvoklik) → idempotenten 200.
    // Response oblika ostane identična (urnik + vključen priceGroup).
    const newIsActive = data.isActive
    const casToggle = await db.happyHourSchedule.updateMany({
      where: { id, isActive: !newIsActive },
      data: { isActive: newIsActive },
    })
    if (casToggle.count === 0) {
      // CAS ni prijel — izbrisana (404) ali že v želenem stanju (idempotentno 200)
      const stillThere = await db.happyHourSchedule.findUnique({
        where: { id },
        include: { priceGroup: true },
      })
      if (!stillThere) {
        return NextResponse.json({ error: 'Happy ura ne obstaja' }, { status: 404 })
      }
      return NextResponse.json(stillThere)
    }
    const updated = await db.happyHourSchedule.findUnique({
      where: { id },
      include: { priceGroup: true },
    })
    if (!updated) {
      // obrambno: izbrisana tik po uspešnem CAS-u → 404 namesto praznega body-a
      return NextResponse.json({ error: 'Happy ura ne obstaja' }, { status: 404 })
    }
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
    // FIX R112 (HH-3, LOW): tekma (dvojni klik / DELETE∥PATCH toggle) — delete
    // po findUnique-u vrže P2025 → prej 500. Canonical mapping: P2025 → 404
    // ('Happy ura ne obstaja' — enako sporočilo kot PATCH CAS veja), P2034 →
    // 409 (vzorec R107/R109/R111). Ostalo gre v handleApiError kot prej.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Happy ura ne obstaja' }, { status: 404 })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return NextResponse.json({ error: 'Konflikt pri brisanju Happy ura (sočasna sprememba). Poskusite znova.' }, { status: 409 })
    }
    return handleApiError(error, 'DELETE /api/happy-hour/[id]', 'Napaka pri brisanju Happy Hour urnika')
  }
}
