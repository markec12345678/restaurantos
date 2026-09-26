// ============================================
// DEVICE UPDATE API — PATCH /api/devices/[id] (P0-#29 Device center, R142-b)
// Preimenoval / prerazporedil napravo (inventar naprav, staff shell UI).
// ============================================
// Varnostne lastnosti (kanon):
//   1. Auth: requireAuth 'admin' — PARITETA z DELETE /api/devices (destruktivna
//      upravna operacija; GET ostaja view_reports).
//   2. R87-4 fail-closed: resolveTenantLocationIdOrThrow TAKOJ za requireAuth,
//      PRED body parse (403 regular NULL / lokacijska seja avtoritativna).
//   3. Zero-oracle 404 (notInScopeResponse kanon — template '{what} ni
//      najden', pariteta feedback rute): tuj tenant IN neobstoječ id dobita
//      ISTI 404 — ni enumeracije naprav čez tenantе.
//      Super-admin (scope.locationId null) sme urejati vsako napravo.
//   4. Prerazporeditev lokacije (body.locationId) je IZKLJUČNO super-admin
//      domena: lokacijski admin → 403 fail-closed (NIKOLI tiho ignoriranje);
//      super-admin validira ciljno lokacijo na obstoj + isActive (400
//      fail-closed, pariteta device-key veje POST /api/devices).
//   5. NIKOLI NE PIŠE status/lastSeenAt/deviceId — to je klient domena
//      (POST/heartbeat/device-sync). Whitelist build payloada.
//   6. Audit V ISTEM tx: createAuditLog(entry, tx) kanon (pariteta
//      PATCH /api/guests/feedback/[id] R140-b) — action 'DEVICE_UPDATE',
//      details = changed fields (old→new; samo metadata naprave, NIKOLI PII).
//   7. Whitelist odgovor (DEVICE_SELECT) + Cache-Control: no-store.
// ============================================

import { db, createAuditLog } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-middleware'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { resolveTenantLocationIdOrThrow, notInScopeResponse } from '@/lib/tenant-scope'
import { DEVICE_SELECT } from '../_helpers/device-select'

export const dynamic = 'force-dynamic'

const patchDeviceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Ime naprave ne sme biti prazno')
      .max(100, 'Ime naprave ne sme preseči 100 znakov')
      .optional(),
    locationId: z.string().min(1, 'locationId ne sme biti prazen').optional(),
  })
  // Vsaj ENO polje mora biti podano (sicer nič za narediti → 400)
  .refine((data) => data.name !== undefined || data.locationId !== undefined, {
    message: 'Podati je treba vsaj eno polje (name ali locationId).',
    path: ['body'],
  })

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    // Rate limiting — admin mutacija (pariteta briefing/dashboard vzorca)
    const rl = await checkRateLimitAsync('devices-update', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // R87-4 kanon: fail-closed scope resolver PRED body parse.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'PATCH /api/devices/[id]',
    })
    if ('error' in scope) return scope.error

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    const { data, error: validationError } = validateBody(patchDeviceSchema, bodyResult.data)
    if (validationError) return validationError

    // Fail-closed: prerazporeditev lokacije je izključno super-admin domena
    // (lokacijski admin → 403, NIKOLI tiho ignoriranje body.locationId).
    if (data.locationId !== undefined && scope.locationId !== null) {
      return NextResponse.json(
        { error: 'Samo skrbnik brez dodeljene lokacije lahko prerazporedi napravo na drugo lokacijo.' },
        { status: 403 },
      )
    }

    // Scope guard: 404 zero-oracle — enak odgovor za neobstoječ id IN za
    // napravo tujega tenanta (NIKOLI 403, ki bi razkril obstoj).
    const existing = await db.deviceRegistry.findUnique({
      where: { id },
      select: { id: true, name: true, locationId: true },
    })
    if (!existing || (scope.locationId && existing.locationId !== scope.locationId)) {
      return notInScopeResponse('Naprava')
    }

    // Diff samo na spremenjenih poljih (no-op podane vrednosti = brez pisanja)
    const newName =
      data.name !== undefined && data.name !== existing.name ? data.name : null
    const newLocationId =
      data.locationId !== undefined && data.locationId !== existing.locationId
        ? data.locationId
        : null

    // Super-admin prerazporeditev: ciljna lokacija MORA obstajati in biti
    // aktivna (pariteta device-key registracijske veje POST /api/devices).
    if (newLocationId !== null) {
      const loc = await db.location.findUnique({
        where: { id: newLocationId },
        select: { id: true, isActive: true },
      })
      if (!loc || !loc.isActive) {
        return NextResponse.json(
          { error: 'Neveljavna ali neaktivna ciljna lokacija za napravo' },
          { status: 400 },
        )
      }
    }

    // No-op (vse podane vrednosti enake trenutnim): 200 brez pisanja/audita.
    if (newName === null && newLocationId === null) {
      const current = await db.deviceRegistry.findUnique({ where: { id }, select: DEVICE_SELECT })
      if (!current) return notInScopeResponse('Naprava')
      return NextResponse.json(
        { device: current },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // WHITELIST payload: NIKOLI status/lastSeenAt/deviceId (klient domena).
    const updateData: { name?: string; locationId?: string } = {}
    if (newName !== null) updateData.name = newName
    if (newLocationId !== null) updateData.locationId = newLocationId

    const updated = await db.$transaction(async (tx) => {
      // Where pin na id (+ tenant scope za lokacijske admine) — vrstica, ki je
      // med branjem in pisanjem izginila (vzporedni DELETE) → count 0 → 404.
      const cas = await tx.deviceRegistry.updateMany({
        where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
        data: updateData,
      })
      if (cas.count === 0) return null

      // Audit V ISTEM tx (createAuditLog(entry, tx) kanon — hash veriga
      // bere/piše v isti transakciji; audit obstaja ⇔ sprememba obstaja).
      // Details: SAMO device metadata (old→new), NIKOLI PII.
      await createAuditLog({
        userId: authResult.session?.employeeId,
        action: 'DEVICE_UPDATE',
        entityType: 'DeviceRegistry',
        entityId: id,
        details: {
          ...(newName !== null ? { name: { before: existing.name, after: newName } } : {}),
          ...(newLocationId !== null
            ? { locationId: { before: existing.locationId, after: newLocationId } }
            : {}),
        },
        locationId: newLocationId ?? existing.locationId,
      }, tx)

      // Fresh read-back v tx — whitelist odgovor (pariteta GET).
      return tx.deviceRegistry.findUnique({ where: { id }, select: DEVICE_SELECT })
    })

    if (!updated) {
      // Vrstica je izginila med branjem in pisanjem → zero-oracle 404
      return notInScopeResponse('Naprava')
    }

    return NextResponse.json(
      { device: updated },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error: unknown) {
    return handleApiError(error, 'PATCH /api/devices/[id]', 'Napaka pri posodabljanju naprave')
  }
}
