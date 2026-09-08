// Pomožne funkcije za online naročila — Async webhook trigger

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { parseWebhookEvents } from '@/lib/json-fields'

// ─── Async webhook trigger — ne blokiraj odziva ───
export async function triggerWebhookAsync(event: string, payload: Record<string, unknown>) {
  try {
    const webhooks = await db.webhook.findMany({ where: { isActive: true } })
    // P1-9: Zod-validiran parser dogodkov (brez gologa JSON.parse)
    const matchingWebhooks = webhooks.filter(wh => parseWebhookEvents(wh.events).some(e => e === event))

    for (const webhook of matchingWebhooks) {
      await db.webhookDelivery.create({
        data: {
          webhookId: webhook.id, event,
          payload: JSON.stringify(payload),
          statusCode: 0, success: false, attemptCount: 0, maxAttempts: 5, nextRetryAt: new Date(),
        },
      })
    }
  } catch (e: unknown) {
    logger.error('API', 'Webhook trigger error:', e)
  }
}
