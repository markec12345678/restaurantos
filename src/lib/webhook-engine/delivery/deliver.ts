// Webhook dostava — HTTP pošiljanje na endpointe

import crypto from 'crypto'
import { signPayload } from '../signing'
import {
  type DeliveryResult,
  WEBHOOK_TIMEOUT_MS,
  MAX_RESPONSE_BODY_LENGTH,
} from '../types'

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
