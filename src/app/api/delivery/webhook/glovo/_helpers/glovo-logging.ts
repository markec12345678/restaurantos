// Glovo WebSocket Broadcast + Integration Logging

import { db } from '@/lib/db'
import { wsBroadcastEvent } from '@/lib/ws-server-broadcast'

// WebSocket Broadcast
// WS AUDIT 2026-09-09: prej HTTP fetch na /api/ws-broadcast (401 — brez
// Authorization glave). Zdaj: direkten globalThis.__wsBroadcast klic.
export function broadcastWS(type: string, payload: unknown) {
  wsBroadcastEvent(type, (payload ?? null) as Record<string, unknown> | null)
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
