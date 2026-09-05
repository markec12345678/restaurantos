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
import { requireAuth } from '@/lib/auth-middleware'
import { resolveTenantLocationId } from '@/lib/auth-middleware/tenant-scope'
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
    const locationId = resolveTenantLocationId(authResult, searchParams ?? null)

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (locationId) where.locationId = locationId

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
    // Heartbeat je dovoljen tudi brez auth (device se javi ob bootu)
    // ampak z API key-jem v headerju
    const apiKey = req.headers.get('x-device-api-key')
    const expectedKey = process.env.DEVICE_API_KEY
    if (expectedKey && apiKey !== expectedKey) {
      const authResult = await requireAuth(req, { permission: 'admin' })
      if (authResult.error) return authResult.error
    }

    const body = await req.json().catch(() => ({}))
    const input = registerSchema.parse(body)

    const device = await db.deviceRegistry.upsert({
      where: { deviceId: input.deviceId },
      create: {
        deviceId: input.deviceId,
        name: input.name,
        type: input.type,
        locationId: input.locationId,
        appVersion: input.appVersion,
        status: 'online',
        lastSeenAt: new Date(),
      },
      update: {
        name: input.name,
        type: input.type,
        locationId: input.locationId,
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

    await db.deviceRegistry.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return handleApiError(err, 'devices DELETE')
  }
}
