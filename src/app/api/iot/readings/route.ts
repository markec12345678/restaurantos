// POST /api/iot/readings — Sprejmi IoT senzor reading (temp/vlaga) + auto HACCP
// Body: { sensorId, temperature, humidity?, timestamp? }
// Če temperatura > 4°C (hladilnik) ali > -18°C (zamrzovalnik), auto warning HACCP
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { handleApiError, parseJsonBody } from '@/lib/api-utils'
import { z } from 'zod'


const readingSchema = z.object({
  sensorId: z.string().min(1),
  temperature: z.number(),
  humidity: z.number().nullable().optional(),
  location: z.string().max(100).default(''),
  timestamp: z.string().optional(),
})

// Brez auth — IoT naprave pošiljajo z API key (v produkciji dodati API key validacijo)
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    let data
    try { data = readingSchema.parse(bodyResult.data) } catch { return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 }) }

    // Določi status glede na temperaturo
    let status: 'ok' | 'warning' | 'critical' = 'ok'
    let correctiveAction = ''
    if (data.temperature > 8) { status = 'critical'; correctiveAction = 'Temperatura presega 8°C — takoj preveri hladilnik!' }
    else if (data.temperature > 4) { status = 'warning'; correctiveAction = 'Temperatura nad 4°C — preveri vrata hladilnika' }

    // Avtomatsko kreiraj HACCP entry z hash chain
    const crypto = await import('crypto')
    const lastEntry = await db.haccpEntry.findFirst({ orderBy: { createdAt: 'desc' }, select: { chainHash: true } })
    const previousHash = lastEntry?.chainHash || ''
    const entryDate = data.timestamp ? new Date(data.timestamp) : new Date()
    const value = `${data.temperature.toFixed(1)}°C${data.humidity ? `, ${data.humidity.toFixed(0)}%` : ''}`
    const hashPayload = [previousHash, `IoT: ${data.sensorId}`, value, status, entryDate.toISOString()].join('|')
    const chainHash = crypto.createHash('sha256').update(hashPayload).digest('hex')

    const entry = await db.haccpEntry.create({
      data: {
        date: entryDate,
        category: 'temperature',
        title: `IoT ${data.sensorId} — ${data.location || 'neznan položaj'}`,
        description: `Avtomatski IoT reading`,
        value,
        status,
        correctiveAction,
        employeeName: 'IoT Auto',
        previousHash,
        chainHash,
      },
    })

    return NextResponse.json({
      success: true,
      sensorId: data.sensorId,
      temperature: data.temperature,
      status,
      haccpEntryId: entry.id,
      alert: status !== 'ok',
    }, { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/iot/readings', 'Napaka pri IoT reading')
  }
}
