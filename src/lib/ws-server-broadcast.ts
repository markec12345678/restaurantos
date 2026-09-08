// ============================================
// WS SERVER BROADCAST — kanonični server-side helper
// ============================================
// WS AUDIT 2026-09-09: vsi server-side broadcasti morajo potekati DIREKTNO
// prek globalThis.__wsBroadcast (isti proces kot custom server s WS).
//
// Prejšnji pristop (HTTP fetch na /api/ws-broadcast) je bil DVOJNO POKVARJEN:
//   1. Klici brez Authorization glave → requireAuth 401 → eventi tiho poginili
//      (KDS/POS real-time obvestila so bila degradirana na polling).
//   2. broadcastWSEvent (bolt, ORDER_FIRED) je uporabljal RELATIVEN URL →
//      server-side fetch vrže "Failed to parse URL" → eventi poginili.
// Poleg tega je bila HTTP ruta sama po sebi attack surface: vsak prijavljen
// uporabnik s 'take_orders' je lahko broadcastal poljuben payload.
//
// Zdaj: server → direkten klic __wsBroadcast (brez HTTP, brez avtentikacije,
// ker je klicatelj IZKLJUČNO zaupanja vredna server koda v istem procesu).
// Na Vercelu/next-dev (brez custom serverja) je __wsBroadcast undefined →
// mirno preskoči (identično prejšnjemu "wsAvailable: false" obnašanju).
// ============================================

import { logger } from '@/lib/logger'

/**
 * Oddaj WebSocket dogodek vsem povezanim odjemalcem (direkten klic).
 * Uporaba SAMO v server kodi (API rute, helperji) — nikoli v klient komponentah.
 *
 * @param type - Tip dogodka (NEW_ORDER, ORDER_UPDATED, ...)
 * @param payload - Podatki dogodka; locationId (kjer izvedljiv) omogoča
 *                 per-location dostavo (klienti drugih lokacij dogodka ne vidijo)
 */
export function wsBroadcastEvent(type: string, payload: Record<string, unknown> | null | undefined): void {
  const broadcastFn = (globalThis as Record<string, unknown>).__wsBroadcast as
    | ((type: string, payload: unknown) => void)
    | undefined

  if (typeof broadcastFn !== 'function') {
    // WS strežnik ni aktiven (next dev / Vercel serverless) — mirno preskoči.
    // To ni napaka: aplikacija deluje tudi brez real-time posodobitev (polling).
    return
  }

  try {
    broadcastFn(type, payload)
  } catch (err: unknown) {
    // Broadcast ne sme podreti poslovnega toka (naročilo je že v DB)
    logger.warn('WS_BROADCAST', `Napaka pri direktnem broadcastu (${type}):`, err instanceof Error ? err.message : String(err))
  }
}
