// ============================================
// WEB PUSH NOTIFICATIONS — Helper functions
// ============================================
// Uporablja web-push knjižnico za pošiljanje push notifications
// preko W3C Push API + VAPID protokola.
//
// VAPID ključi se generirajo enkrat in se shranijo v env:
//   VAPID_PUBLIC_KEY  — javni ključ (pošlje se klientu)
//   VAPID_PRIVATE_KEY — zasebni ključ (strežnik samo)
//   VAPID_SUBJECT     — mailto: ali https: URL
//
// Generiranje ključev:
//   node -e "console.log(require('web-push').generateVAPIDKeys())"
// ============================================

import webpush from 'web-push'
import { logger } from '@/lib/logger'

let vapidConfigured = false

function configureVapid() {
  if (vapidConfigured) return

  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@restaurantos.local'

  if (!publicKey || !privateKey) {
    logger.warn('PUSH', 'VAPID ključi manjkajo — push notifications onemogočeni. Generiraj z: node -e "console.log(require(\'web-push\').generateVAPIDKeys())"')
    return
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
  logger.info('PUSH', 'VAPID konfiguriran — push notifications aktivne')
}

export interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: Record<string, unknown>
  actions?: Array<{ action: string; title: string; icon?: string }>
  requireInteraction?: boolean
}

/**
 * Pošlji push notification na eno subscripcijo
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushPayload
): Promise<{ success: boolean; error?: string }> {
  configureVapid()
  if (!vapidConfigured) {
    return { success: false, error: 'VAPID ni konfiguriran' }
  }

  try {
    await webpush.sendNotification(
      subscription as webpush.PushSubscription,
      JSON.stringify(payload)
    )
    return { success: true }
  } catch (err: unknown) {
    const error = err as { statusCode?: number; body?: string; message?: string }
    // 410 = subscripcija je bila preklicana, 404 = neveljavna
    if (error.statusCode === 410 || error.statusCode === 404) {
      logger.info('PUSH', `Subscripcija ni več veljavna (${error.statusCode}) — brišem`)
      return { success: false, error: 'SUBSCRIPTION_EXPIRED' }
    }
    logger.error('PUSH', 'Napaka pri pošiljanju push notification:', error.message || err)
    return { success: false, error: error.message || 'Napaka pri pošiljanju' }
  }
}

/**
 * Pošlji push notification vsem subscripcijam (broadcast)
 */
export async function broadcastPushNotification(
  subscriptions: PushSubscription[],
  payload: PushPayload
): Promise<{ sent: number; failed: number; expired: string[] }> {
  let sent = 0
  let failed = 0
  const expired: string[] = []

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const result = await sendPushNotification(sub, payload)
      if (result.success) {
        sent++
      } else {
        failed++
        if (result.error === 'SUBSCRIPTION_EXPIRED') {
          expired.push(sub.endpoint)
        }
      }
    })
  )

  // Pripravi povzetek
  const rejected = results.filter(r => r.status === 'rejected').length
  if (rejected > 0) {
    failed += rejected
  }

  logger.info('PUSH', `Broadcast: ${sent} poslanih, ${failed} neuspešnih, ${expired.length} poteklih`)
  return { sent, failed, expired }
}

/**
 * Preveri ali so VAPID ključi konfigurirani
 */
export function isPushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

/**
 * Vrni javni VAPID ključ za klienta
 */
export function getVapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY || ''
}
