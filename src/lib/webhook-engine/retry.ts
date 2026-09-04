// ============================================
// WEBHOOK ENGINE — Ponovni poskusi (retry worker)
// Obdelava webhooke, ki čakajo na ponovni poskus
// ============================================

import { db } from '@/lib/db'
import { deliverWebhook } from './delivery'
import { RETRY_DELAYS_MS } from './types'
import { ensureDecrypted } from '@/lib/crypto/secrets'

/**
 * Obdela vse webhooke, ki čakajo na ponovni poskus
// Pokliči periodično (npr. vsako minuto iz API rute ali cron)
 */
export async function processRetryQueue(): Promise<{
  processed: number
  succeeded: number
  failed: number
}> {
  const now = new Date()
  let processed = 0
  let succeeded = 0
  let failed = 0

  // Pridobi vse dostave, ki potrebujejo ponovni poskus
  const pendingDeliveries = await db.webhookDelivery.findMany({
    where: {
      success: false,
      nextRetryAt: { lte: now },
      attemptCount: { lt: 6 }, // Max 5 ponovnih poskusov + 1 začetni = 6
    },
    take: 50, // Omejitev na 50 na obdelavo
    orderBy: { createdAt: 'asc' },
  })

  for (const delivery of pendingDeliveries) {
    // Pridobi webhook
    const webhook = await db.webhook.findUnique({ where: { id: delivery.webhookId } })
    if (!webhook || !webhook.isActive) {
      // Webhook ne obstaja več ali je onemogočen — označi kot neuspešno
      await db.webhookDelivery.update({
        where: { id: delivery.id },
        data: { nextRetryAt: null, success: false },
      })
      continue
    }

    const newAttemptCount = delivery.attemptCount + 1
    const result = await deliverWebhook(
      webhook.url,
      delivery.payload,
      delivery.signature,
      ensureDecrypted(webhook.secret)
    )

    processed++

    if (result.success) {
      succeeded++
      await db.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          statusCode: result.statusCode,
          responseBody: result.responseBody,
          success: true,
          attemptCount: newAttemptCount,
          deliveredAt: new Date(),
          nextRetryAt: null,
        },
      })

      // Ponastavi števec napak
      await db.webhook.update({
        where: { id: webhook.id },
        data: { failureCount: 0 },
      })
    } else {
      failed++
      const retryIndex = newAttemptCount - 1 // 0-based index
      const nextRetryDelay = RETRY_DELAYS_MS[retryIndex] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]
      const hasMoreRetries = newAttemptCount < delivery.maxAttempts

      await db.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          statusCode: result.statusCode,
          responseBody: result.responseBody,
          attemptCount: newAttemptCount,
          nextRetryAt: hasMoreRetries ? new Date(Date.now() + nextRetryDelay) : null,
        },
      })

      if (!hasMoreRetries) {
        // Vsi poskusi izčrpani — povečaj števec napak
        await db.webhook.update({
          where: { id: webhook.id },
          data: { failureCount: { increment: 1 } },
        })
      }
    }
  }

  return { processed, succeeded, failed }
}
