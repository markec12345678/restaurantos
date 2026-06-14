// ============================================
// WEBHOOK ENGINE — Dostava, podpisovanje, ponovni poskusi
// Profesionalen sistem za zanesljivo dostavo webhookov
// Podpira: HMAC-SHA256 podpisovanje, eksponentno vračanje, omejitev poskusov
// ============================================

import crypto from 'crypto'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// ============================================
// TIPI
// ============================================

export type WebhookEventType =
  | 'order.created'
  | 'order.updated'
  | 'order.paid'
  | 'order.ready'
  | 'order.cancelled'
  | 'order.delivered'
  | 'payment.received'
  | 'payment.refunded'
  | 'receipt.created'
  | 'receipt.fiscal_verified'
  | 'stock.low'
  | 'stock.critical'
  | 'stock.restocked'
  | 'shift.started'
  | 'shift.ended'
  | 'cash_register.opened'
  | 'cash_register.closed'
  | 'reservation.created'
  | 'reservation.cancelled'
  | 'guest.created'
  | 'loyalty.tier_upgraded'
  | 'daily_report.ready'
  | 'delivery.status_changed'
  | 'delivery.driver_assigned'
  | 'tip_pool.distributed'
  | 'z_report.generated'
  | 'z_report.finalized'
  | 'integration.sync_failed'

export interface WebhookPayload {
  id: string
  event: WebhookEventType
  timestamp: string
  data: Record<string, unknown>
  restaurant?: {
    name: string
    id: string
  }
}

interface DeliveryResult {
  success: boolean
  statusCode: number
  responseBody: string
  durationMs: number
}

// ============================================
// KONSTANTE
// ============================================

const WEBHOOK_TIMEOUT_MS = 10_000 // 10 sekund timeout
const MAX_RESPONSE_BODY_LENGTH = 1000 // Prvih 1000 znakov odziva
const RETRY_DELAYS_MS = [60_000, 300_000, 900_000, 3_600_000, 10_800_000] // 1min, 5min, 15min, 1h, 3h
const MAX_PAYLOAD_SIZE = 256 * 1024 // 256 KB max payload

// ============================================
// PODPISOVANJE
// ============================================

/**
 * Ustvari HMAC-SHA256 podpis za webhook payload
 * Format: sha256=<hex-digest> (enako kot GitHub/Stripe webhooks)
 */
export function signPayload(payload: string, secret: string): string {
  if (!secret) return ''
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  return `sha256=${hmac.digest('hex')}`
}

/**
 * Preveri HMAC-SHA256 podpis (za prejem webhooks)
 * FIX MEDIUM: timingSafeEqual zahteva enako dolžino bufferjev — padding za varno primerjavo
 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false
  const expected = signPayload(payload, secret)
  try {
    const sigBuf = Buffer.from(signature)
    const expBuf = Buffer.from(expected)
    // FIX: Če sta bufferja različnih dolžin, primerjamo z začasnimi bufferji enake dolžine
    // timingSafeEqual zahteva enako dolžino — različna dolžina že razkrije informacijo
    const maxLen = Math.max(sigBuf.length, expBuf.length)
    const sigPadded = Buffer.alloc(maxLen)
    const expPadded = Buffer.alloc(maxLen)
    sigBuf.copy(sigPadded)
    expBuf.copy(expPadded)
    return crypto.timingSafeEqual(sigPadded, expPadded)
  } catch {
    return false
  }
}

// ============================================
// DOBAVA
// ============================================

/**
 * Pošlji webhook na endpoint z ustreznimi glavami in timeoutom
 */
async function deliverWebhook(
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
function isInternalUrl(url: string): boolean {
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

// ============================================
// PONOVNI POSKUSI (retry worker)
// ============================================

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
      webhook.secret
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

// ============================================
// TEST WEBHOOK
// ============================================

/**
 * Pošlji testni webhook na podan URL
 */
export async function testWebhookDelivery(
  url: string,
  secret: string
): Promise<DeliveryResult & { deliveryId?: string }> {
  const testPayload: WebhookPayload = {
    id: crypto.randomUUID(),
    event: 'order.created' as WebhookEventType, // Testni dogodek
    timestamp: new Date().toISOString(),
    data: { message: 'Testni webhook iz RestaurantOS', version: '1.0' },
  }

  const payloadStr = JSON.stringify(testPayload)
  const signature = signPayload(payloadStr, secret)

  const result = await deliverWebhook(url, payloadStr, signature, secret)

  return result
}
