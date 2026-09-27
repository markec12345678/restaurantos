// ============================================
// GET /api/export/portability — #34 Data portability (R147-b)
// ============================================
// Owner portability arhiv (JSON, 'restaurantos-portability' v1): 17 tabel v
// 5 sekcijah (customers / menu / recipes / inventory+stock ledger / audit),
// tenant-scoped (MODEL A) in preverljiv (counts + countsChecksum + checksum +
// schemaStamp — reuse backup serialize canon: encodeRowValues /
// canonicalStringify / computeChecksum).
//
//   ?mode=manifest — counts per tabela per sekcija (BREZ vrstic; count()
//                    queries), checksum '' (backup manifest vzorec),
//   ?mode=full     — polne sekcije + checksum (default),
//   ?locationId    — MODEL A cross-branch za super-admina (brez = global),
//                    regular z lokacijo → seja avtoritativna, regular brez
//                    → 403 fail-closed (NO_LOCATION_MESSAGE).
//
// Kanon (R146 precedens): force-dynamic + maxDuration 60; rate-limit bucket
// 'data-portability' PRED authom; auth permission 'admin' (manager bypass NE
// preide — pariteta /api/locations); audit DATA_PORTABILITY_EXPORTED SAMO ob
// 200 full mode (manifest = cheap read brez audit zapisa); Cache-Control
// no-store na vseh uspešnih odgovorih; handleApiError 500.
//
// Zero-oracle (R146-b deviation 2 precedens): neobstoječa ?locationId →
// 200 s praznimi sekcijami (resolver NIMA existence checka; export je list,
// ne single-resource — brez 404 asimetrije, ki bi razkrivala obstoj).
// ============================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
// Resolver iz '@/lib/tenant-scope' (NIČ skozi barrel — r82 mock topologija,
// R146-b deviation 7).
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { createAuditLog, db } from '@/lib/db'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError } from '@/lib/api-utils'
// serialize reuse (IMPORT, NE fork — backup drill regresija mora ostati zelena)
import { canonicalStringify, computeChecksum } from '@/lib/backup/serialize'
import {
  buildPortabilitySections,
  PORTABILITY_MODELS,
  PORTABILITY_NOTES,
  PORTABILITY_SECTIONS,
} from './_helpers/portability-sections'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PORTABILITY_FORMAT = 'restaurantos-portability'
const PORTABILITY_VERSION = 1

/** UTC stamp YYYYMMDD-HHmmss za filename (determinističen format, brez ':'/'.'). */
function portabilityStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`
  )
}

export async function GET(req: Request) {
  try {
    // R146 kanon: rate limit PRED authom (prosti string bucket — presets.ts nedotaknjen)
    const rl = await checkRateLimitAsync('data-portability', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    // 'admin' permission: samo role admin (+super_admin s permissionom) —
    // manager bypass NE preide (permissions.ts :41 manager guard).
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error || authResult.session === null) {
      // BUG-HUNT kanon (backup route): `session: null, error: null` je JAVNA
      // pot, NE avtorizacija — zahtevamo DEJANSKO sejo.
      return authResult.error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)

    // MODEL A: regular brez lokacije → 403 fail-closed (NO_LOCATION_MESSAGE);
    // lokacijska seja avtoritativna (?locationId ignoriran); super-admin brez
    // ?locationId = null (global), z ?locationId = cross-branch.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/export/portability',
    })
    if ('error' in scope) return scope.error
    const locationId = scope.locationId

    // mode: 'manifest' | 'full' (default full); neznana vrednost → 400.
    const modeParam = searchParams.get('mode')
    if (modeParam !== null && modeParam !== '' && modeParam !== 'manifest' && modeParam !== 'full') {
      return NextResponse.json({ error: 'Neznan način. Dovoljeno: manifest, full' }, { status: 400 })
    }
    const mode = modeParam === 'manifest' ? 'manifest' : 'full'
    const includeRows = mode === 'full'

    const data = await buildPortabilitySections({ locationId, includeRows })

    // scope.locationName — snapshot imena lokacije za samo-opis arhiva
    // (neobstoječa lokacija → null; zero-oracle ostaja 200).
    let locationName: string | null = null
    if (locationId) {
      const loc = await db.location.findUnique({
        where: { id: locationId },
        select: { name: true },
      })
      locationName = loc?.name ?? null
    }

    const schemaStamp = computeChecksum(PORTABILITY_MODELS.join(','))
    const countsChecksum = computeChecksum(data.counts)
    // Checksum pokrije PODATKE (sections), ne ovojnico (generatedAt se
    // namenoma spreminja) → isti DB snapshot = isti checksum (preverljivost).
    const checksum = includeRows ? computeChecksum(data.sections) : ''

    const notes = PORTABILITY_NOTES

    // ── manifest mode: counts-only JSON (brez attachment glav) ──
    if (!includeRows) {
      return NextResponse.json(
        {
          format: PORTABILITY_FORMAT,
          version: PORTABILITY_VERSION,
          generatedAt: new Date().toISOString(),
          schemaStamp,
          scope: { locationId, locationName },
          counts: data.counts,
          countsChecksum,
          checksum,
          notes,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // ── full mode: kanoničen JSON attachment ──
    const payload = {
      format: PORTABILITY_FORMAT,
      version: PORTABILITY_VERSION,
      generatedAt: new Date().toISOString(),
      schemaStamp,
      scope: { locationId, locationName },
      counts: data.counts,
      countsChecksum,
      sections: data.sections,
      checksum,
      notes,
    }
    const body = canonicalStringify(payload)

    // Audit SAMO ob 200 full mode (R146 kanon: audit obstaja ⇔ izvoz uspel);
    // manifest je cheap read — brez zapisa. Details counters-only (PII-free).
    await createAuditLog({
      action: 'DATA_PORTABILITY_EXPORTED',
      entityType: 'PortabilityExport',
      entityId: `${mode}:${locationId ?? 'global'}`,
      userId: authResult.session?.employeeId,
      locationId: locationId ?? null,
      details: {
        mode,
        tables: data.tableCount,
        sections: data.sectionCount,
        rows: data.totalCount,
        checksum,
      },
    })

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="prenos-podatkov-${portabilityStamp(new Date())}.json"`,
        'X-Portability-Checksum': checksum,
        'X-Portability-Sections': PORTABILITY_SECTIONS.join(','),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/export/portability', 'Napaka pri izdelavi prenosa podatkov')
  }
}
