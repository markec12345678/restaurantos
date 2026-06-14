// ============================================
// WEBHOOK ENGINE — Dostava
// Pošiljanje webhookov na endpointe, SSRF zaščita, beleženje
// ============================================

import crypto from 'crypto'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { signPayload } from './signing'
import {
  type WebhookEventType,
  type WebhookPayload,
  type DeliveryResult,
  WEBHOOK_TIMEOUT_MS,
  MAX_RESPONSE_BODY_LENGTH,
  MAX_PAYLOAD_SIZE,
  RETRY_DELAYS_MS,
} from './types'

// ============================================
// DOBAVA
// ============================================

/**
 * Pošlji webhook na endpoint z ustreznimi glavami in timeoutom
 */
export async function deliverWebhook(
  url: string,
  payload: string,
  signature: string,
  secret: string
): Promise<DeliveryResult> {
  const startTime = Date.now()

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'RestaurantOS-Webhook/1.0',
      'X-Webhook-Signature': signature,
      'X-Webhook-Timestamp': new Date().toISOString(),
      'X-Webhook-ID': crypto.randomUUID(),
    }

    // Če ima webhook skrivnost, dodamo tudi "Stripe-style" glavo
    if (secret) {
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const signaturePayload = `${timestamp}.${payload}`
      const sig = signPayload(signaturePayload, secret)
      headers['X-Webhook-Signature-256'] = sig
      headers['X-Webhook-Timestamp-Sec'] = timestamp
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: payload,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const responseBody = await response.text()
    const durationMs = Date.now() - startTime

    return {
      success: response.status >= 200 && response.status < 300,
      statusCode: response.status,
      responseBody: responseBody.substring(0, MAX_RESPONSE_BODY_LENGTH),
      durationMs,
    }
  } catch (error: unknown) {
    const durationMs = Date.now() - startTime
    const isTimeout = error instanceof Error && error.name === 'AbortError'

    return {
      success: false,
      statusCode: isTimeout ? 408 : 0,
      responseBody: isTimeout ? 'Request timed out' : (error instanceof Error ? error.message : 'Unknown error'),
      durationMs,
    }
  }
}

// ============================================
// GLAVNA FUNKCIJA — SPROŽI WEBHOOK
// ============================================

/**
 * Sproži webhook dogodek — poišče vse aktivne webhooke za ta dogodek
 * in jih asinhrono dostavi. Ne blokira klicanja.
 *
 * FIX MEDIUM: SSRF zaščita — preveri, da URL ni notranji (localhost, 10.x, 172.16-31.x, 192.168.x)
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
 * FIX MEDIUM: Preveri, ali URL kaže na notranji/lokalni naslov (SSRF zaščita)
 */
export function isInternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()
    // Lokalni naslovi
    if (hostname === 'localhost' || hostname === '0.0.0.0' || hostname === '::1') {
      return true
    }
    // FIX HIGH: Celoten 127.x.x.x loopback obseg (ne le 127.0.0.1)
    if (/^127\./.test(hostname)) return true
    // FIX HIGH: IPv4-mapped IPv6 loopback
    if (/^::ffff:127\./.test(hostname)) return true
    // FIX HIGH: Link-local naslovi
    if (/^169\.254\./.test(hostname)) return true
    // FIX HIGH: IPv6 unique local (fc00::/7)
    if (/^f[cd]/.test(hostname)) return true
    // Privatni RFC1918 obsegi
    if (/^10\./.test(hostname) || /^192\.168\./.test(hostname)) {
      return true
    }
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) {
      return true
    }
    // .local, .internal, .test TLD
    if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.test')) {
      return true
    }
    return false
  } catch {
    return true // Neveljaven URL = zavrnjen
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

  const signature = signPayload(payloadStr, webhook.secret)

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
  const result = await deliverWebhook(webhook.url, payloadStr, signature, webhook.secret)

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
    const nextRetryDelay = RETRY_DELAYS_MS[0] // Prvi ponovni poskus čez 1 min
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
