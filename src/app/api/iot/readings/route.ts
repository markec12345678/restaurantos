// POST /api/iot/readings — Sprejmi IoT senzor reading (temp/vlaga) + auto HACCP
// Body: { sensorId, temperature, humidity?, timestamp? }
// Če temperatura > 4°C (hladilnik) ali > -18°C (zamrzovalnik), auto warning HACCP
//
// SECURITY: Avtentikacija z API ključem (header `X-IoT-Api-Key`).
// Prejšnja implementacija je bila BREZ avtentikacije — vsak je lahko
// injiciral lažne temperature, ki so avtomatsko ustvarile HACCP vnose
// in s tem zastrupile revizijsko sled (EU 852/2004).
//
// API ključ se nastavi v env `IOT_API_KEY` in deli z vsemi senzorji.
// Za produkcijsko namestitev z več senzorji priporočamo per-senzor ključ
// (shranjen v bazi, vendar to zahteva schema spremembo — zaenkrat env).
import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { handleApiError, parseJsonBody } from '@/lib/api-utils'
import { checkRateLimitAsync, getClientIp, IOT_LIMIT } from '@/lib/rate-limit'
import { createHaccpEntryWithChain } from '@/lib/haccp-chain'
import { logger } from '@/lib/logger'
import { z } from 'zod'


const readingSchema = z.object({
  sensorId: z.string().min(1),
  temperature: z.number(),
  humidity: z.number().nullable().optional(),
  location: z.string().max(100).default(''),
  timestamp: z.string().optional(),
})

export const dynamic = 'force-dynamic'

/**
 * Preveri IoT API ključ iz header-ja.
 * Vrne true, če je ključ veljaven.
 */
function verifyIoTApiKey(req: Request): boolean {
  const expectedKey = process.env.IOT_API_KEY
  if (!expectedKey) {
    // Če env ni nastavljen, NE dovolimo pisanja (fail-closed).
    // Prejšnja koda je bila BREZ auth — to je bila varnostna luknja.
    logger.warn('IOT', 'IOT_API_KEY ni nastavljen — IoT readings zavrnjeni')
    return false
  }
  const provided = req.headers.get('x-iot-api-key')
  if (!provided) return false
  // Constant-time primerjava
  const a = Buffer.from(expectedKey)
  const b = Buffer.from(provided)
  if (a.length !== b.length) return false
  // timingSafeEqual zahteva enako dolžino
  return crypto.timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  try {
    // SECURITY: Rate limit + API key
    const clientIp = getClientIp(req)
    const rateCheck = await checkRateLimitAsync('iot-readings', clientIp, IOT_LIMIT)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Preveč zahtevkov' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.retryAfterMs || 60000) / 1000)) } }
      )
    }

    if (!verifyIoTApiKey(req)) {
      return NextResponse.json(
        { error: 'Neveljaven ali manjkajoč API ključ. Pošlji X-IoT-Api-Key header.' },
        { status: 401 }
      )
    }

    const bodyResult = await parseJsonBody(req)
    if (bodyResult.error) return bodyResult.error
    let data
    try { data = readingSchema.parse(bodyResult.data) } catch { return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 }) }

    // Določi status glede na temperaturo
    let status: 'ok' | 'warning' | 'critical' = 'ok'
    let correctiveAction = ''
    if (data.temperature > 8) { status = 'critical'; correctiveAction = 'Temperatura presega 8°C — takoj preveri hladilnik!' }
    else if (data.temperature > 4) { status = 'warning'; correctiveAction = 'Temperatura nad 4°C — preveri vrata hladilnika' }

    // Avtomatsko kreiraj HACCP entry z hash chain ZNOTRAJ transakcije.
    // FIX CRITICAL (race): prejšnja koda je brala lastEntry zunaj transakcije.
    const entryDate = data.timestamp ? new Date(data.timestamp) : new Date()
    const value = `${data.temperature.toFixed(1)}°C${data.humidity ? `, ${data.humidity.toFixed(0)}%` : ''}`
    const entry = await createHaccpEntryWithChain({
      date: entryDate,
      category: 'temperature',
      title: `IoT ${data.sensorId} — ${data.location || 'neznan položaj'}`,
      description: 'Avtomatski IoT reading',
      value,
      status,
      correctiveAction,
      employeeName: 'IoT Auto',
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
