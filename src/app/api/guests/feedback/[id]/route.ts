// ============================================
// GUEST FEEDBACK RESOLUTION API — PATCH status prehod (P1-14, R140-b)
// Toast POS + OpenTable standard: mnenje gosta dobi življenjski ciklus
// new → in_review → resolved (staff obdelava + odgovor restavracije).
// ============================================
// Varnostne lastnosti (kanon):
//   1. Auth: ISTI kanon kot GET/POST /api/guests/feedback — staff PIN seja
//      z 'take_orders' dovoljenjem.
//   2. R87-4 fail-closed: resolveTenantLocationIdOrThrow TAKOJ za requireAuth,
//      PRED body parse (403 regular NULL / 400 super-admin brez ?locationId).
//   3. Zero-oracle 404 (notInScopeResponse kanon): tuj tenant IN neobstoječ id
//      dobita ISTI 404 — ni enumeracije mnenj čez tenantе.
//   4. CAS prehodi (R112 kanon): updateMany s where pinom na pričakovani
//      status + scope; count 0 po najdeni vrstici = stale → 409 (osvežite).
//   5. Snapshot forenzika: ob 'resolved' se resolvedById (iz seje, NIKOLI od
//      klienta) + resolvedByName (Employee snapshot) + resolvedAt zapišejo V
//      ISTEM tx kot prehod.
//   6. Audit V ISTEM tx: createAuditLog(entry, tx) kanon — audit obstaja ⇔
//      prehod obstaja (pariteta delivery_delivered R137-b).
//   7. Whitelist odgovor (FEEDBACK_SELECT) — brez notranjih worker refov.
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { resolveTenantLocationIdOrThrow, notInScopeResponse } from '@/lib/tenant-scope'
import { FEEDBACK_SELECT } from '../_helpers/feedback-select'

export const dynamic = 'force-dynamic'

// CAS prehodi (R112 kanon): dovoljeni izvorni statusi glede na cilj.
//   new→in_review, new→resolved, in_review→resolved.
// Nazaj (resolved→in_review), no-op in izmišljeni prehodi → 409.
const ALLOWED_FROM: Record<'in_review' | 'resolved', string[]> = {
  in_review: ['new'],
  resolved: ['new', 'in_review'],
}

const patchFeedbackSchema = z.object({
  status: z.enum(['in_review', 'resolved']),
  response: z
    .string()
    .trim()
    .min(1, 'Odgovor ne sme biti prazen')
    .max(1000, 'Odgovor ne sme preseči 1000 znakov')
    .optional(),
})

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params

    const authResult = await requireAuth(req, { permission: 'take_orders' })
    if (authResult.error) return authResult.error

    // R87-4 kanon: fail-closed scope resolver PRED body parse.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'PATCH /api/guests/feedback/[id]',
    })
    if ('error' in scope) return scope.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    const { data, error: validationError } = validateBody(patchFeedbackSchema, bodyResult.data)
    if (validationError) return validationError

    // Scope guard: 404 zero-oracle — enak odgovor za neobstoječ id IN za
    // mnenje tujega tenanta (NIKOLI 403, ki bi razkril obstoj).
    const existing = await db.guestFeedback.findUnique({
      where: { id },
      select: { id: true, status: true, locationId: true },
    })
    if (!existing || (scope.locationId && existing.locationId !== scope.locationId)) {
      return notInScopeResponse('Povratna informacija')
    }

    // Prijazen 409 za znane neveljavne prehode (šele za scope guardom —
    // sporočilo ne razkriva ničesar tujemu klicatelju).
    const allowedFrom = ALLOWED_FROM[data.status]
    if (!allowedFrom.includes(existing.status)) {
      return NextResponse.json(
        { error: `Neveljaven prehod statusa mnenja (${existing.status} → ${data.status}).` },
        { status: 409 },
      )
    }

    const session = authResult.session
    const isResolving = data.status === 'resolved'
    const now = new Date()

    const updated = await db.$transaction(async (tx) => {
      // Snapshot imena zaposlenega (identiteta iz seje, NIKOLI od klienta) —
      // tx-fresh read, pariteta self-claim R137-b.
      let resolvedByName: string | null = null
      if (isResolving) {
        const emp = session?.employeeId
          ? await tx.employee.findUnique({ where: { id: session.employeeId }, select: { name: true } })
          : null
        resolvedByName = emp?.name ?? null
      }

      // CAS (R112 kanon): where pin na pričakovani status (+ tenant scope).
      // count 0 = drug writer je vrstico med branjem in pisanjem spremenil.
      const cas = await tx.guestFeedback.updateMany({
        where: {
          id,
          status: { in: allowedFrom },
          ...(scope.locationId ? { locationId: scope.locationId } : {}),
        },
        data: {
          status: data.status,
          // 'response' je opcijski: prisoten → odgovor restavracije + žig
          // (prvi pisatelj write-never polj responded/response/respondedAt)
          ...(data.response !== undefined
            ? { response: data.response, respondedAt: now, responded: true }
            : {}),
          // 'resolved' → worker forenzika (id iz seje + ime snapshot + čas)
          ...(isResolving
            ? { resolvedById: session?.employeeId ?? null, resolvedByName, resolvedAt: now }
            : {}),
        },
      })
      if (cas.count === 0) return null

      // Audit V ISTEM tx (createAuditLog(entry, tx) kanon — hash veriga
      // bere/piše v isti transakciji; audit obstaja ⇔ prehod obstaja).
      await createAuditLog({
        userId: session?.employeeId,
        action: isResolving ? 'feedback_resolved' : 'feedback_status_changed',
        entityType: 'GuestFeedback',
        entityId: id,
        details: {
          before: existing.status,
          after: data.status,
          response: data.response ?? null,
          locationId: existing.locationId,
        },
        locationId: existing.locationId,
      }, tx)

      // Fresh read-back v tx — whitelist odgovor (pariteta GET).
      return tx.guestFeedback.findUnique({ where: { id }, select: FEEDBACK_SELECT })
    })

    if (!updated) {
      return NextResponse.json(
        { error: 'Status mnenja je v medčasu spremenjen — osvežite pogled.' },
        { status: 409 },
      )
    }

    return NextResponse.json(
      { success: true, feedback: updated },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error: unknown) {
    return handleApiError(error, 'PATCH /api/guests/feedback/[id]', 'Napaka pri posodabljanju povratne informacije')
  }
}
