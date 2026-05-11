import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'

// POST /api/ws-broadcast — Oddaj WebSocket dogodek vsem povezanim odjemalcem
// To API kličejo API rute (orders, order-items), ko želijo obvestiti KDS odjemalce
export async function POST(req: Request) {
  try {
    // FIX BUG 22: Zahtevaj avtentikacijo — prepreči zlorabo za lažna obvestila
    const authResult = await requireAuth(req)
    if (authResult.error) return authResult.error

    const body = await req.json()
    const { type, payload } = body

    if (!type) {
      return NextResponse.json({ error: 'Manjka tip dogodka' }, { status: 400 })
    }

    // Dovoljeni tipi WebSocket dogodkov (prepreči poljubne dogodke)
    const ALLOWED_TYPES = ['NEW_ORDER', 'ORDER_UPDATED', 'ITEM_STATUS_CHANGED', 'ORDER_CANCELLED']
    if (!ALLOWED_TYPES.includes(type)) {
      return NextResponse.json({ error: `Nedovoljen tip dogodka: ${type}` }, { status: 400 })
    }

    // Uporabi globalni broadcast, ki ga je nastavil server.js
    const broadcastFn = (globalThis as Record<string, unknown>).__wsBroadcast

    if (typeof broadcastFn === 'function') {
      try {
        broadcastFn(type, payload)
        return NextResponse.json({ success: true, message: `Dogodek ${type} oddan` })
      } catch (err) {
        console.error('[WS Broadcast API] Napaka:', err)
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
  } catch (error) {
    console.error('[WS Broadcast API] Napaka:', error)
    return NextResponse.json({ error: 'Napaka pri broadcastu' }, { status: 500 })
  }
}
