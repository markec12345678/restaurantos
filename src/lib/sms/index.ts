// ============================================
// SMS NOTIFICATIONS — 98% open rate (raziskava 2025)
// ============================================
// Uporablja Twilio ali MessageBird API za pošiljanje SMS
// Namenjeno: rezervacije, pripravljenost naročila, loyalty obvestila
// ============================================

import { logger } from '@/lib/logger'

// SMS provider konfiguracija
const SMS_PROVIDER = process.env.SMS_PROVIDER || '' // 'twilio' | 'messagebird' | ''
const SMS_ACCOUNT_SID = process.env.SMS_ACCOUNT_SID || ''
const SMS_AUTH_TOKEN = process.env.SMS_AUTH_TOKEN || ''
const SMS_FROM = process.env.SMS_FROM || '' // +386XXXXXXXX
const SMS_API_KEY = process.env.SMS_API_KEY || '' // MessageBird

export interface SmsMessage {
  to: string // +386XXXXXXXX
  body: string
  type?: 'reservation' | 'order_ready' | 'loyalty' | 'marketing' | 'transactional'
}

export interface SmsResult {
  success: boolean
  messageId?: string
  error?: string
}

export function isSmsConfigured(): boolean {
  if (SMS_PROVIDER === 'twilio') return !!(SMS_ACCOUNT_SID && SMS_AUTH_TOKEN && SMS_FROM)
  if (SMS_PROVIDER === 'messagebird') return !!(SMS_API_KEY && SMS_FROM)
  return false
}

/**
 * Pošlji SMS preko konfiguriranega provider-ja
 */
export async function sendSms(message: SmsMessage): Promise<SmsResult> {
  if (!isSmsConfigured()) {
    logger.warn('SMS', `SMS ni konfiguriran — sporočilo za ${message.to} ni poslano`)
    return { success: false, error: 'SMS ni konfiguriran' }
  }

  // Validiraj številko (osnovni format)
  const phone = message.to.replace(/[\s\-()]/g, '')
  if (!/^\+\d{6,15}$/.test(phone)) {
    return { success: false, error: 'Neveljavna telefonska številka' }
  }

  try {
    if (SMS_PROVIDER === 'twilio') {
      return await sendViaTwilio(phone, message.body)
    } else if (SMS_PROVIDER === 'messagebird') {
      return await sendViaMessageBird(phone, message.body)
    }
    return { success: false, error: `Neznan SMS provider: ${SMS_PROVIDER}` }
  } catch (err: unknown) {
    logger.error('SMS', 'Napaka pri pošiljanju SMS:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Neznana napaka' }
  }
}

/**
 * Pošlji več SMS-ov hkrati (batch)
 */
export async function sendSmsBatch(messages: SmsMessage[]): Promise<SmsResult[]> {
  return Promise.all(messages.map(sendSms))
}

// ─── Twilio ──────────────────────────────────────────────
async function sendViaTwilio(to: string, body: string): Promise<SmsResult> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${SMS_ACCOUNT_SID}/Messages.json`
  const auth = Buffer.from(`${SMS_ACCOUNT_SID}:${SMS_AUTH_TOKEN}`).toString('base64')

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: to,
      From: SMS_FROM,
      Body: body,
    }),
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) {
    const err = await res.text()
    return { success: false, error: `Twilio ${res.status}: ${err}` }
  }

  const data = await res.json()
  return { success: true, messageId: data.sid }
}

// ─── MessageBird ─────────────────────────────────────────
async function sendViaMessageBird(to: string, body: string): Promise<SmsResult> {
  const res = await fetch('https://rest.messagebird.com/messages', {
    method: 'POST',
    headers: {
      'Authorization': `AccessKey ${SMS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipients: [to],
      originator: SMS_FROM,
      body,
    }),
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) {
    const err = await res.text()
    return { success: false, error: `MessageBird ${res.status}: ${err}` }
  }

  const data = await res.json()
  return { success: true, messageId: data.id }
}

// ─── Predpripravljene SMS predloge ──────────────────────

export function reservationConfirmationSms(
  restaurantName: string,
  dateTime: string,
  partySize: number,
  tableNumber?: number
): string {
  return `${restaurantName}: Vaša rezervacija je potrjena! ${dateTime}, ${partySize} oseb${
    tableNumber ? `, miza ${tableNumber}` : ''
  }. Lepo dobrodošli!`
}

export function orderReadySms(
  restaurantName: string,
  orderNumber: number,
  tableNumber?: number
): string {
  return `${restaurantName}: Vaše naročilo #${orderNumber} je pripravljeno!${
    tableNumber ? ` Postreženo k mizi ${tableNumber}.` : ''
  } Dober tek!`
}

export function loyaltyRewardSms(
  restaurantName: string,
  pointsBalance: number,
  reward: string
): string {
  return `${restaurantName}: Čestitamo! Imate ${pointsBalance} zvestobnih točk. Unovčili ste: ${reward}. Hvala za vašo zvestobo!`
}

export function tableReadySms(
  restaurantName: string,
  tableNumber: number,
  waitlistPosition?: number
): string {
  return `${restaurantName}: Vaša miza ${tableNumber} je pripravljena!${
    waitlistPosition ? ` (Bili ste ${waitlistPosition}. v vrsti.)` : ''
  } Pridite v 15 minutah, prosim.`
}
