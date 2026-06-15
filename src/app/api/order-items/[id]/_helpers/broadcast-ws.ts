// WebSocket broadcast helper

import { getAppUrl } from '@/lib/utils'

// Helper za WebSocket broadcast
export async function broadcastWS(type: string, payload: unknown) {
  try {
    await fetch(`${getAppUrl()}/api/ws-broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    })
  } catch {
    // WS strežnik ni na voljo
  }
}
