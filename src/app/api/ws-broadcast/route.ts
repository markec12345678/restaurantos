
// Zod shema za WebSocket broadcast
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIp, WS_BROADCAST_LIMIT } from '@/lib/rate-limit'
import { z } from 'zod'
import { handleApiError, validateRequest } from '@/lib/api-utils'

const wsBroadcastSchema = z.object({
  type: z.enum(
    ['NEW_ORDER', 'ORDER_UPDATED', 'ITEM_STATUS_CHANGED', 'ORDER_CANCELLED', 'ORDER_FIRED', 'ITEM_STATUS_UPDATE', 'STOCK_LOW', 'CALL_WAITER', 'LOW_STOCK'],
    { message: 'Nedovoljen tip dogodka' }
  ),
  payload: z.unknown().optional(),
})

// POST /api/ws-broadcast — Oddaj WebSocket dogodek vsem povezanim odjemalcem
// To API kličejo API rute (orders, order-items), ko želijo obvestiti KDS odjemalce
export async function POST(req: Request) {
  try {
    // FIX BUG 22: Zahtevaj avtentikacijo — prepreči zlorabo za lažna obvestila
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    // FIX: Omejitev hitrosti — prepreči hitro zaporedje WS dogodkov
    const ip = getClientIp(req)
    const rateLimit = checkRateLimit('ws-broadcast', ip, WS_BROADCAST_LIMIT)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Preveč zahtevkov' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.retryAfterMs || 60000) / 1000)) } }
      )
    }

    const result = await validateRequest(req, wsBroadcastSchema)
    if (result.error) return result.error

    const { type, payload } = result.data

    // Uporabi globalni broadcast, ki ga je nastavil server.js
    const broadcastFn = (globalThis as Record<string, unknown>).__wsBroadcast

    if (typeof broadcastFn === 'function') {
      try {
        broadcastFn(type, payload)
        return NextResponse.json({ success: true, message: `Dogodek ${type} oddan` })
      } catch (err: unknown) {
        logger.error('API', '[WS Broadcast API] Napaka:', err)
        return NextResponse.json({ success: false, error: 'Napaka pri oddaji' }, { status: 500 })
      }
    }

    // Če WebSocket strežnik ni na voljo (npr. next dev brez server.js)
    // Samo vrni uspeh — dogodek se ne bo oddal, ampak aplikacija še vedno deluje
    return NextResponse.json({
      success: true,
      message: 'WebSocket strežnik ni na voljo — dogodek preskočen',
      wsAvailable: false,
    })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/ws-broadcast', 'Napaka pri broadcastu')
  }
}
