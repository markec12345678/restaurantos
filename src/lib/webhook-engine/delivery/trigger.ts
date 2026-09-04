// Webhook sprožitev — poišče aktivne webhooke in dostavi asinhrono

import crypto from 'crypto'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { signPayload } from '../signing'
import {
  type WebhookEventType,
  type WebhookPayload,
  MAX_PAYLOAD_SIZE,
  RETRY_DELAYS_MS,
} from '../types'
import { deliverWebhook } from './deliver'
import { isInternalUrl } from './ssrf'
import { ensureDecrypted } from '@/lib/crypto/secrets'

/**
 * Sproži webhook dogodek — poišče vse aktivne webhooke za ta dogodek
 * in jih asinhrono dostavi. Ne blokira klicanja.
 */
export async function triggerWebhook(
  event: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> {
  // Pridobi restavracijske nastavitve za kontekst
  let restaurantInfo = { name: 'RestaurantOS', id: '' }
  try {
    const settings = await db.restaurantSettings.findFirst({ where: { isActive: true } })
    if (settings) {
      restaurantInfo = { name: settings.name, id: settings.id }
    }
  } catch {
    // Nastavitve niso obvezne
  }

  // Pridobi vse aktivne webhooke, ki poslušajo ta dogodek
  const webhooks = await db.webhook.findMany({
    where: { isActive: true },
  })

  const matchingWebhooks = webhooks.filter(wh => {
    try {
      const events: string[] = JSON.parse(wh.events || '[]')
      return events.includes(event)
    } catch {
      return false
    }
  })

  // Za vsak ujemajoč webhook — dostavi asinhrono
  for (const webhook of matchingWebhooks) {
    // FIX MEDIUM: SSRF zaščita — prepreči pošiljanje na notranje naslove
    if (isInternalUrl(webhook.url)) {
      logger.warn('WebhookEngine', `SSRF zavrnjen: webhook ${webhook.id} kaže na notranji naslov: ${webhook.url}`)
      continue
    }

    // Ne čakaj na dostavo — pošlji v ozadje
    deliverAndLog(webhook, event, data, restaurantInfo).catch(err => {
      logger.error('WebhookEngine', `Napaka pri dostavi webhook ${webhook.id}:`, err)
    })
  }
}

/**
 * Dostavi webhook in zabeleži rezultat
 */
async function deliverAndLog(
  webhook: { id: string; url: string; secret: string; failureCount: number },
  event: string,
  data: Record<string, unknown>,
  restaurant: { name: string; id: string }
): Promise<void> {
  const payload: WebhookPayload = {
    id: crypto.randomUUID(),
    event: event as WebhookEventType,
    timestamp: new Date().toISOString(),
    data,
    restaurant,
  }

  const payloadStr = JSON.stringify(payload)

  // Omejitev velikosti payloada
  if (payloadStr.length > MAX_PAYLOAD_SIZE) {
    logger.warn('WebhookEngine', `Payload prevelik (${payloadStr.length} bajtov) za webhook ${webhook.id}`)
    return
  }

  const decryptedSecret = ensureDecrypted(webhook.secret)
  const signature = signPayload(payloadStr, decryptedSecret)

  // Ustvari log vnose pred dostavo
  const delivery = await db.webhookDelivery.create({
    data: {
      webhookId: webhook.id,
      event,
      payload: payloadStr,
      signature,
      attemptCount: 1,
      maxAttempts: RETRY_DELAYS_MS.length + 1,
      success: false,
    },
  })

  // Dostavi
  const result = await deliverWebhook(webhook.url, payloadStr, signature, decryptedSecret)

  if (result.success) {
    // Uspešna dostava
    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        statusCode: result.statusCode,
        responseBody: result.responseBody,
        success: true,
        deliveredAt: new Date(),
      },
    })

    // Ponastavi števec napak na webhooku
    if (webhook.failureCount > 0) {
      await db.webhook.update({
        where: { id: webhook.id },
        data: {
          lastTriggered: new Date(),
          failureCount: 0,
        },
      })
    } else {
      await db.webhook.update({
        where: { id: webhook.id },
        data: { lastTriggered: new Date() },
      })
    }
  } else {
    // Neuspešna dostava — načrtuj ponovni poskus
    const nextRetryDelay = RETRY_DELAYS_MS[0]
    const nextRetryAt = new Date(Date.now() + nextRetryDelay)

    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        statusCode: result.statusCode,
        responseBody: result.responseBody,
        success: false,
        nextRetryAt,
      },
    })

    // Povečaj števec napak
    await db.webhook.update({
      where: { id: webhook.id },
      data: {
        lastTriggered: new Date(),
        failureCount: { increment: 1 },
      },
    })
  }
}
