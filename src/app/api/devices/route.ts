// ============================================
// /api/devices — POS Device Registry
// ============================================
// Sledi POS napravam in njihovem offline/online statusu.
// Uporablja se za:
//   - Dashboard "katere naprave so online"
//   - Outbox prioritizacijo (offline naprave imajo večji backlog)
//   - Diagnostiko (kdaj je bila nazadnje vidna)
// ============================================
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, resolveTenantLocationId, tenantScopeToWhere } from '@/lib/auth-middleware'
import { handleApiError } from '@/lib/api-utils'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const registerSchema = z.object({
  deviceId: z.string().min(1).max(200),
  name: z.string().min(1).max(100),
  type: z.enum(['pos', 'kds', 'tablet', 'mobile', 'kiosk']).default('pos'),
  locationId: z.string().max(100).optional(),
  appVersion: z.string().max(50).default(''),
})

// GET — seznam naprav
export async function GET(req: Request) {
  try {
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

    // Označi naprave kot offline, če niso bile vidne >5min
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
    await db.deviceRegistry.updateMany({
      where: {
        status: 'online',
        lastSeenAt: { lt: fiveMinAgo },
      },
      data: { status: 'offline' },
    })

    const devices = await db.deviceRegistry.findMany({
      where,
      include: { location: { select: { id: true, name: true, code: true } } },
      orderBy: { lastSeenAt: 'desc' },
    })

    return NextResponse.json({ devices, count: devices.length })
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
    if (expectedKey && apiKey === expectedKey) {
      // Trusted device (skupni ključ) — brez sessiona; locationId se validira na obstoj
    } else {
      const authResult = await requireAuth(req, { permission: 'admin' })
      if (authResult.error) return authResult.error
      session = authResult.session ?? null
    }

    const body = await req.json().catch(() => ({}))
    const input = registerSchema.parse(body)

    // FIX IDOR (tenant scope): locationId iz bodyja NI avtoritativen —
    //   - admin z session.locationId → prisiljena session lokacija
    //   - super admin (session z locationId=null) → lahko določi locationId
    //   - device heartbeat (skupni ključ, brez sessiona) → locationId se
    //     validira na obstoj aktivne lokacije (naprava ne more registrirati
    //     neveljavne/tuje lokacije na slepo)
    const sessionLoc = session?.locationId ?? null
    let resolvedLocationId: string | null = input.locationId ?? null
    if (sessionLoc) {
      resolvedLocationId = sessionLoc
    } else if (!session && resolvedLocationId) {
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
    const sessionLocationId = authResult.session?.locationId ?? undefined
    const deleted = await db.deviceRegistry.deleteMany({
      where: { id, ...(sessionLocationId ? { locationId: sessionLocationId } : {}) },
    })
    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Naprava ni najdena' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return handleApiError(err, 'devices DELETE')
  }
}
