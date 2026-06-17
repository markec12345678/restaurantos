// GET/POST /api/iot/sensors — IoT temperature/humidity senzorji
// Za Bluetooth LoRa senzorje (SmartSense, Ruuvi) integracijo z HACCP
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { handleApiError, parseJsonBody, validateBody } from '@/lib/api-utils'
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

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'view_reports' })
    if (authResult.error) return authResult.error
    // Vrni vse HaccpEntry temperature vnose kot senzor readings
    const entries = await db.haccpEntry.findMany({
      where: { category: 'temperature' },
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
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    const { data, error } = validateBody(sensorSchema, bodyResult.data)
    if (error) return error
    // Shrani kot HaccpEntry (IoT senzor → HACCP dnevnik)
    const crypto = await import('crypto')
    const lastEntry = await db.haccpEntry.findFirst({ orderBy: { createdAt: 'desc' }, select: { chainHash: true } })
    const previousHash = lastEntry?.chainHash || ''
    const value = `${data.minThreshold}-${data.maxThreshold}°C`
    const hashPayload = [previousHash, data.name, value, 'ok', new Date().toISOString()].join('|')
    const chainHash = crypto.createHash('sha256').update(hashPayload).digest('hex')
    const entry = await db.haccpEntry.create({
      data: {
        category: 'temperature',
        title: `IoT senzor: ${data.name}`,
        description: `Senzor ${data.sensorId} na lokaciji ${data.location}`,
        value,
        status: 'ok',
        employeeName: 'IoT Auto',
        previousHash,
        chainHash,
      },
    })
    return NextResponse.json(entry, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/iot/sensors', 'Napaka pri ustvarjanju senzorja')
  }
}
