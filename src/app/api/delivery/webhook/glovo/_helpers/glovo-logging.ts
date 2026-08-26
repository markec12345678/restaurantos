// Glovo WebSocket Broadcast + Integration Logging

import { db } from '@/lib/db'

// WebSocket Broadcast
export async function broadcastWS(type: string, payload: unknown) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`
    await fetch(`${appUrl}/api/ws-broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    })
  } catch {
    // WS strežnik ni na voljo
  }
}

// Integration Logging + Sync
export async function logAndSyncIntegration(
  integrationId: string,
  body: string,
  orderId: string,
  orderNumber: number,
) {
  await db.integrationLog.create({
    data: {
      integrationId,
      action: 'receive_order',
      direction: 'inbound',
      status: 'success',
      statusCode: 200,
      requestData: body.substring(0, 2000),
      responseData: JSON.stringify({ orderId, orderNumber }),
      durationMs: 0,
    },
  })
  await db.integration.update({
    where: { id: integrationId },
    data: { lastSyncAt: new Date(), lastSyncStatus: 'success', connectionStatus: 'connected' },
  })
}
