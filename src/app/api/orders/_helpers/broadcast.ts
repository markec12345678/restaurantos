// Pomožne funkcije za WebSocket broadcast in samodejni tisk

import { getAppUrl } from '@/lib/utils'

// Helper za WebSocket broadcast (varen klic — deluje tudi brez WS strežnika)
export async function broadcastWS(type: string, payload: unknown) {
  try {
    await fetch(`${getAppUrl()}/api/ws-broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    })
  } catch {
    // WS strežnik ni na voljo — tiho prezri
  }
}

// Helper za samodejni tisk kuhinjskega naročila
export async function autoPrintKitchenOrder(order: Record<string, unknown>) {
  try {
    await fetch(`${getAppUrl()}/api/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'order', orderId: order.id }),
    })
  } catch {
    // Tiskanje ni na voljo — tiho prezri
  }
}
