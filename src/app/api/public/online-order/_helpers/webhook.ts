// Pomožne funkcije za online naročila — Async webhook trigger

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// ─── Async webhook trigger — ne blokiraj odziva ───
export async function triggerWebhookAsync(event: string, payload: Record<string, unknown>) {
  try {
    const webhooks = await db.webhook.findMany({ where: { isActive: true } })
    const matchingWebhooks = webhooks.filter(wh => {
      try {
        const events: string[] = JSON.parse(wh.events)
        return events.includes(event)
      } catch { return false }
    })

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
