import { NextResponse } from 'next/server'

// POST /api/ws-broadcast — Oddaj WebSocket dogodek vsem povezanim odjemalcem
// To API kličejo API rute (orders, order-items), ko želijo obvestiti KDS odjemalce
export async function POST(req: Request) {
  const body = await req.json()
  const { type, payload } = body

  if (!type) {
    return NextResponse.json({ error: 'Manjka tip dogodka' }, { status: 400 })
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
}
