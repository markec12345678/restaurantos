// Pomožne funkcije za WebSocket broadcast in samodejni tisk

import { wsBroadcastEvent } from '@/lib/ws-server-broadcast'
import { logger } from '@/lib/logger'
import { handleOrderPrint } from '@/app/api/print/_helpers'

// Helper za WebSocket broadcast (varen klic — deluje tudi brez WS strežnika)
// WS AUDIT 2026-09-09: prej HTTP fetch na /api/ws-broadcast (401 — klici niso
// poslali Authorization glave, eventi so tiho poginili). Zdaj: direkten
// globalThis.__wsBroadcast klic v istem procesu custom serverja.
export function broadcastWS(type: string, payload: unknown) {
  wsBroadcastEvent(type, (payload ?? null) as Record<string, unknown> | null)
}

// Helper za samodejni tisk kuhinjskega naročila
// FIX R78 (QA 2026-09-19): prej interni HTTP fetch na /api/print BREZ
// Authorization glave → auth middleware je vrnil 401 na vsako naročilo
// (isti razred napake kot WS broadcast, popravljen 2026-09-09 — ta klicatelj
// je bil izpuščen). Samodejni tisk kuhinjskega naročila NI NIKOLI deloval.
// Zdaj: direkten in-process klic handleOrderPrint (isti proces, brez HTTP
// hopa in brez auth potrebe — klicatelj je že avtenticiran order handler).
export async function autoPrintKitchenOrder(order: Record<string, unknown>) {
  try {
    // R86-4: order.locationId pass-through (Order.locationId NOT NULL) —
    // samodejni tisk ostane vezan na lokacijo naročila.
    await handleOrderPrint(
      order.id as string,
      undefined,
      typeof order.locationId === 'string' ? order.locationId : null,
    )
  } catch (error: unknown) {
    // Tiskanje ni na voljo — logiraj kot info (ne kritično)
    logger.info('PRINT', `Samodejni tisk nedosegljiv za order ${order.id}:`, error instanceof Error ? error.message : error)
  }
}
