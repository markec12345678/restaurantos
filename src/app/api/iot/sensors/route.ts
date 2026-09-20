// GET/POST /api/iot/sensors — IoT temperature/humidity senzorji
// Za Bluetooth LoRa senzorje (SmartSense, Ruuvi) integracijo z HACCP
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth, resolveTenantLocationIdOrThrow } from '@/lib/auth-middleware'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
import { createHaccpEntryWithChain } from '@/lib/haccp-chain'
import { z } from 'zod'


const sensorSchema = z.object({
  sensorId: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['temperature', 'humidity', 'combined']),
  location: z.string().max(100).default(''),
  minThreshold: z.number().default(-20),
  maxThreshold: z.number().default(8),
  isActive: z.boolean().default(true),
})

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error
    // R84-FIX2 (final-auditor MEDIUM): role-aware scope — prej presence-based
    // (null session.locationId = globalno TUDI za ne-admine brez lokacije).
    // Kanonični resolver: fail-closed 403 za lokacijsko nevezanega ne-admina.
    const { searchParams } = new URL(req.url)
    const scope = resolveTenantLocationIdOrThrow(authResult.session, searchParams, {
      endpoint: 'GET /api/iot/sensors',
    })
    if ('error' in scope) return scope.error
    const entries = await db.haccpEntry.findMany({
      where: { category: 'temperature', ...(scope.locationId ? { locationId: scope.locationId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({ sensors: entries, total: entries.length })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/iot/sensors', 'Napaka pri pridobivanju senzorjev')
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error
    // R86-2b (M2 razred, fail-open žig zaprt): prej RAW `session?.locationId ??
    // null` — non-admin seja (permission 'admin' je permission, ne vloga) z
    // NULL lokacijo je lahko registrirala senzor na POLJUBNI body locationId
    // (samo existence-check). Resolver: non-admin brez lokacije → 403
    // fail-closed; body kandidat dosegljiv SAMO null-scope super-adminu.
    const scope = resolveTenantLocationIdOrThrow(authResult.session, new URL(req.url).searchParams, {
      endpoint: 'POST /api/iot/sensors',
    })
    if ('error' in scope) return scope.error
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    const { data, error } = validateBody(sensorSchema, bodyResult.data)
    if (error) return error
    // Shrani kot HaccpEntry (IoT senzor → HACCP dnevnik)
    // FIX CRITICAL (race): uporabi transakcijsko varno createHaccpEntryWithChain
    const value = `${data.minThreshold}-${data.maxThreshold}°C`
    // R83: atribucija lokacije — lokacijsko vezan admin registrira senzor na
    // svoji lokaciji (prej NULL); platform admin lahko poda izbirni body.locationId
    // R86-2b: scope iz resolverja; super-admin BREZ veljavnega body locationId
    // → 400 fail-closed (prej NULL žig → P2011 500 na NOT NULL stolpcu).
    let sensorLocationId: string | null = scope.locationId
    if (!sensorLocationId) {
      const bodyLocId = typeof (bodyResult.data as { locationId?: string } | undefined)?.locationId === 'string'
        ? (bodyResult.data as { locationId?: string }).locationId!.trim()
        : null
      if (!bodyLocId) {
        return NextResponse.json(
          { error: 'locationId je obvezen: seja nima dodeljene lokacije — podaj locationId.' },
          { status: 400 },
        )
      }
      const loc = await db.location.findUnique({ where: { id: bodyLocId }, select: { id: true } })
      if (!loc) {
        return NextResponse.json({ error: 'Neveljavna lokacija (locationId ne obstaja)' }, { status: 400 })
      }
      sensorLocationId = loc.id
    }
    const entry = await createHaccpEntryWithChain({
      date: new Date(),
      category: 'temperature',
      title: `IoT senzor: ${data.name}`,
      description: `Senzor ${data.sensorId} na lokaciji ${data.location}`,
      value,
      status: 'ok',
      employeeName: 'IoT Auto',
      locationId: sensorLocationId,
    })
    return NextResponse.json(entry, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/iot/sensors', 'Napaka pri ustvarjanju senzorja')
  }
}
