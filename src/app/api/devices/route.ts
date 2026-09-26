// ============================================
// /api/devices — POS Device Registry
// ============================================
// Sledi POS napravam in njihovem offline/online statusu.
// Uporablja se za:
//   - Dashboard "katere naprave so online"
//   - Outbox prioritizacijo (offline naprave imajo večji backlog)
//   - Diagnostiko (kdaj je bila nazadnje videna)
//
// R142-b (epic #115 #29 Device center) — GET dograjen po kanonu:
//   • DEVICE_SELECT compile-time whitelist (pariteta FEEDBACK_SELECT R140-b;
//     prej `include location` = polne vrstice — PII/leak canon),
//   • Cache-Control: no-store,
//   • rate limit AUTHENTICATED_LIMIT bucket 'devices-list' (briefing vzorec),
//   • sweep (write-on-GET updateMany) ODSTRANJEN — GET je čisto read-only;
//     online svežina je izračunana (isOnline = lastSeenAt ≥ now − 5 min, isti
//     5-min pravilnik kot prejšnji sweep); DB `status` stolpec ostane, kot je
//     (klient domena). Noben obstoječi test ni odvisen od sweepa
//     (idor-round13 + r86-c2 pokrivata samo POST/DELETE).
// ============================================
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, resolveTenantLocationId, tenantScopeToWhere } from '@/lib/auth-middleware'
import { resolveTenantLocationIdOrThrow } from '@/lib/tenant-scope'
import { isAdminTenantRole } from '@/lib/tenant-scope'
import { checkRateLimitAsync, getClientIp, AUTHENTICATED_LIMIT } from '@/lib/rate-limit'
import { rateLimitedResponse } from '@/lib/rate-limit/response'
import { handleApiError } from '@/lib/api-utils'
import { z } from 'zod'
import { DEVICE_SELECT } from './_helpers/device-select'

export const dynamic = 'force-dynamic'

/** Online svežina (R142-b): lastSeenAt ≥ now − 5 min = isOnline (pariteta sweepa). */
const ONLINE_WINDOW_MS = 5 * 60 * 1000

const registerSchema = z.object({
  deviceId: z.string().min(1).max(200),
  name: z.string().min(1).max(100),
  type: z.enum(['pos', 'kds', 'tablet', 'mobile', 'kiosk']).default('pos'),
  locationId: z.string().max(100).optional(),
  appVersion: z.string().max(50).default(''),
})

// GET — seznam naprav (R142-b: whitelist + no-store + rate limit + read-only)
export async function GET(req: Request) {
  try {
    // Rate limiting — prepreči zlorabo API-ja (briefing/dashboard pariteta)
    const rl = await checkRateLimitAsync('devices-list', getClientIp(req), AUTHENTICATED_LIMIT)
    if (!rl.allowed) return rateLimitedResponse(rl.retryAfterMs, 'Preveč zahtevkov')

    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    // FIX P0-C2: Centralni tenant scope resolver — fail-closed, no ?locationId bypass
    const scope = resolveTenantLocationId(authResult.session, searchParams, {
      endpoint: 'GET /api/devices',
    })
    if (!scope.ok) return scope.error

    const where: Record<string, unknown> = {
      ...tenantScopeToWhere(scope),
    }
    if (status) where.status = status

    // R142-b: sweep (write-on-GET) odstranjen — branje NE piše; stanje "online"
    // se izračuna iz lastSeenAt (isti 5-min pravilnik). DB `status` ostane,
    // kot je (vzdržujejo ga POST/heartbeat/device-sync — klient domena).
    const devices = await db.deviceRegistry.findMany({
      where,
      select: DEVICE_SELECT,
      orderBy: { lastSeenAt: 'desc' },
    })

    const onlineCutoff = Date.now() - ONLINE_WINDOW_MS
    const withFreshness = devices.map((device) => ({
      ...device,
      isOnline: device.lastSeenAt != null && device.lastSeenAt.getTime() >= onlineCutoff,
    }))

    return NextResponse.json(
      { devices: withFreshness, count: withFreshness.length },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    return handleApiError(err, 'devices GET')
  }
}

// POST — registracija ali heartbeat (upsert)
export async function POST(req: Request) {
  try {
    // FIX SECURITY (fail-closed): prej je bila avtentikacija pogojna — če
    // DEVICE_API_KEY NI bil nastavljen, je POST deloval BREZ katerekoli
    // avtentikacije (anonimna registracija naprave!). Sedaj:
    //   - DEVICE_API_KEY nastavljen + ustrezen key → trusted device heartbeat
    //   - sicer → admin session (obvezno)
    const apiKey = req.headers.get('x-device-api-key')
    const expectedKey = process.env.DEVICE_API_KEY
    let session: import('@/lib/auth-middleware').Session | null = null
    // R128 (epic #115 P0-5): tretja auth veja — non-admin seja PRISILI
    // lokacijo iz seje (undefined = veja ni aktivna; null = 403).
    let nonAdminForcedLocationId: string | undefined = undefined
    if (expectedKey && apiKey === expectedKey) {
      // Trusted device (skupni ključ) — brez sessiona; locationId se validira na obstoj
    } else {
      const authResult = await requireAuth(req, { permission: 'admin' })
      if (authResult.error) {
        // R128: katerikoli avtenticiran zaposleni lahko registrira/utripa
        // napravo SAMO svoje lokacije (POS tablet natakarja ne rabi admin
        // pravic za reconnect). Admin/super-admin in device-key poti
        // ostajata nespremenjeni (IDOR guardi intaktni).
        const anyAuth = await requireAuth(req)
        if (anyAuth.error) return authResult.error
        session = anyAuth.session ?? null
        if (session && !isAdminTenantRole(session.role)) {
          if (!session.locationId) {
            return NextResponse.json({ error: 'TENANT_REQUIRED' }, { status: 403 })
          }
          nonAdminForcedLocationId = session.locationId
        }
      } else {
        session = authResult.session ?? null
      }
    }

    const body = await req.json().catch(() => ({}))
    const input = registerSchema.parse(body)

    // FIX IDOR (tenant scope): locationId iz bodyja NI avtoritativen —
    //   - admin z session.locationId → prisiljena session lokacija
    //   - super admin (session z locationId=null) → lahko določi locationId
    //   - device heartbeat (skupni ključ, brez sessiona) → locationId se
    //     validira na obstoj aktivne lokacije (naprava ne more registrirati
    //     neveljavne/tuje lokacije na slepo)
    // R86-2c2 (M2 klasa): session pot gre skozi kanonski resolver — prej raw
    // `session?.locationId ?? null` je bil fail-OPEN za non-admin seja z NULL
    // lokacijo: body.locationId uporabljen BREZ validacije → registracija/
    // prevzem naprave poljubnega tenanta. Zdaj: 403 fail-closed.
    let resolvedLocationId: string | null = input.locationId ?? null
    if (nonAdminForcedLocationId !== undefined) {
      // R128 tretja veja: body.locationId se IGNORIRA — non-admin sme
      // upravljati izključno naprave svoje lokacije (fail-closed).
      resolvedLocationId = nonAdminForcedLocationId
    } else if (session) {
      const scope = resolveTenantLocationIdOrThrow(session, new URL(req.url).searchParams, {
        endpoint: 'POST /api/devices',
      })
      if ('error' in scope) return scope.error
      if (scope.locationId) {
        resolvedLocationId = scope.locationId
      }
      // super-admin (scope.locationId null): body locationId (pooblaščeno,
      // brez validacije — zaupanje platformnemu adminu) ali null (globalna naprava)
    } else if (resolvedLocationId) {
      const loc = await db.location.findUnique({
        where: { id: resolvedLocationId },
        select: { id: true, isActive: true },
      })
      if (!loc || !loc.isActive) {
        return NextResponse.json(
          { error: 'Neveljavna ali neaktivna lokacija za registracijo naprave' },
          { status: 400 },
        )
      }
    }

    const device = await db.deviceRegistry.upsert({
      where: { deviceId: input.deviceId },
      create: {
        deviceId: input.deviceId,
        name: input.name,
        type: input.type,
        locationId: resolvedLocationId,
        appVersion: input.appVersion,
        status: 'online',
        lastSeenAt: new Date(),
      },
      update: {
        name: input.name,
        type: input.type,
        locationId: resolvedLocationId,
        appVersion: input.appVersion,
        status: 'online',
        lastSeenAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, device })
  } catch (err) {
    return handleApiError(err, 'devices POST')
  }
}

// DELETE — odstrani napravo
export async function DELETE(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id je obvezen' }, { status: 400 })

    // FIX IDOR (tenant scope): izbriši SAMO napravo znotraj session lokacije
    // (super admin z locationId=null vidi vse)
    // R86-2c2 (M2 klasa): resolver namesto raw spread — non-admin NULL lokacija
    // → 403 fail-closed (prej: globalni deleteMany poljubne naprave).
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'DELETE /api/devices',
    })
    if ('error' in scope) return scope.error
    const deleted = await db.deviceRegistry.deleteMany({
      where: { id, ...(scope.locationId ? { locationId: scope.locationId } : {}) },
    })
    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Naprava ni najdena' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return handleApiError(err, 'devices DELETE')
  }
}
