// Implementacije posameznih terminalskih providerjev

import { toNum } from '@/lib/decimal'
import { escapeXml, mapPaymentType } from './types-and-config'
import type { TerminalConfig, PaymentRequest, TerminalResponse } from './types-and-config'

export async function processTerminalPayment(config: TerminalConfig, request: PaymentRequest): Promise<TerminalResponse> {
  const timestamp = new Date().toISOString()

  switch (config.provider) {
    case 'nexgo':
      return processNexgoPayment(config, request, timestamp)
    case 'pax':
      return processPAXPayment(config, request, timestamp)
    case 'sumup':
      return processSumUpPayment(config, request, timestamp)
    case 'square':
      return processSquarePayment(config, request, timestamp)
    case 'test':
    default:
      return processTestPayment(config, request, timestamp)
  }
}

async function processNexgoPayment(config: TerminalConfig, request: PaymentRequest, timestamp: string): Promise<TerminalResponse> {
  try {
    const response = await fetch(`http://${config.ipAddress}:${config.port}/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transType: mapPaymentType(request.paymentType),
        amount: String(Math.round(toNum(request.amount) * 100)),
        tipAmount: String(Math.round(toNum(request.tipAmount || 0) * 100)),
        currency: request.currency,
        reference: `ORD-${request.orderNumber}`,
        terminalId: config.terminalId,
        merchantId: config.merchantId,
      }),
      signal: AbortSignal.timeout(60000),
    })
    const data = await response.json() as Record<string, unknown>
    return {
      success: data.result === 'APPROVED',
      transactionId: data.transactionId as string | undefined,
      authorizationCode: data.authCode as string | undefined,
      cardType: data.cardType as string | undefined,
      cardLast4: data.cardLast4 as string | undefined,
      provider: 'nexgo',
      timestamp,
      error: data.result !== 'APPROVED' ? String(data.error || 'Plačilo zavrnjeno') : undefined,
    }
  } catch (err: unknown) {
    return { success: false, provider: 'nexgo', timestamp, error: `Nexgo: ${err instanceof Error ? err.message : 'Timeout'}` }
  }
}

// FIX HIGH: XML escaping za PAX integracijo — prepreči XML injection
async function processPAXPayment(config: TerminalConfig, request: PaymentRequest, timestamp: string): Promise<TerminalResponse> {
  try {
    // FIX HIGH: Escape vse vrednosti, ki se vstavljajo v XML
    const safeMerchantId = escapeXml(config.merchantId || '')
    const safeTerminalId = escapeXml(config.terminalId || '')
    const safeTranType = escapeXml(mapPaymentType(request.paymentType))
    const safeAmount = String(Math.round(toNum(request.amount) * 100))

    const xmlBody = `<?xml version="1.0"?><TStream><Transaction><MerchantID>${safeMerchantId}</MerchantID><TerminalID>${safeTerminalId}</TerminalID><TranType>${safeTranType}</TranType><Amount><Purchase>${safeAmount}</Purchase></Amount></Transaction></TStream>`

    const response = await fetch(`http://${config.ipAddress}:${config.port}/pax`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body: xmlBody,
      signal: AbortSignal.timeout(60000),
    })
    const xml = await response.text()
    const getField = (tag: string) => { const m = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`)); return m ? m[1] : undefined }
    const authCode = getField('AuthCode')
    return {
      success: !!authCode,
      authorizationCode: authCode,
      cardType: getField('CardType'),
      cardLast4: getField('Last4'),
      provider: 'pax',
      timestamp,
      error: authCode ? undefined : 'Plačilo zavrnjeno',
    }
  } catch (err: unknown) {
    return { success: false, provider: 'pax', timestamp, error: `PAX: ${err instanceof Error ? err.message : 'Timeout'}` }
  }
}

async function processSumUpPayment(config: TerminalConfig, request: PaymentRequest, timestamp: string): Promise<TerminalResponse> {
  if (!config.apiKey) return { success: false, provider: 'sumup', timestamp, error: 'SumUp API ključ ni nastavljen' }
  try {
    const response = await fetch(`https://api.sumup.com/v0.1/merchants/${encodeURIComponent(config.merchantId || '')}/payments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: request.amount, currency: request.currency, checkout_reference: `ORD-${request.orderNumber}`, tip_amount: request.tipAmount || undefined }),
      signal: AbortSignal.timeout(60000),
    })
    const data = await response.json() as Record<string, unknown>
    return {
      success: data.status === 'PAID',
      transactionId: data.id as string | undefined,
      authorizationCode: data.auth_code as string | undefined,
      cardType: data.card_type as string | undefined,
      cardLast4: data.last4_digits as string | undefined,
      provider: 'sumup',
      timestamp,
      error: data.status !== 'PAID' ? String(data.error_message || 'Plačilo zavrnjeno') : undefined,
    }
  } catch (err: unknown) {
    return { success: false, provider: 'sumup', timestamp, error: `SumUp: ${err instanceof Error ? err.message : 'Timeout'}` }
  }
}

async function processSquarePayment(config: TerminalConfig, request: PaymentRequest, timestamp: string): Promise<TerminalResponse> {
  if (!config.apiKey) return { success: false, provider: 'square', timestamp, error: 'Square API ključ ni nastavljen' }
  try {
    const response = await fetch('https://connect.squareup.com/v2/payments', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'Square-Version': '2024-01-18' },
      body: JSON.stringify({ idempotency_key: `pos-${request.orderId}-${Date.now()}`, amount_money: { amount: Math.round(toNum(request.amount) * 100), currency: request.currency }, reference_id: `ORD-${request.orderNumber}`, location_id: config.merchantId }),
      signal: AbortSignal.timeout(60000),
    })
    const data = await response.json() as { payment?: { id?: string; status?: string; card_details?: { card?: { card_brand?: string; last_4?: string }; auth_result_code?: string } }; errors?: Array<{ detail?: string }> }
    const p = data.payment
    return {
      success: p?.status === 'COMPLETED',
      transactionId: p?.id,
      authorizationCode: p?.card_details?.auth_result_code,
      cardType: p?.card_details?.card?.card_brand,
      cardLast4: p?.card_details?.card?.last_4,
      provider: 'square',
      timestamp,
      error: p?.status !== 'COMPLETED' ? (data.errors?.[0]?.detail || 'Plačilo zavrnjeno') : undefined,
    }
  } catch (err: unknown) {
    return { success: false, provider: 'square', timestamp, error: `Square: ${err instanceof Error ? err.message : 'Timeout'}` }
  }
}

async function processTestPayment(_config: TerminalConfig, request: PaymentRequest, timestamp: string): Promise<TerminalResponse> {
  await new Promise((resolve) => setTimeout(resolve, 1500))
  const approved = Math.random() > 0.05
  if (!approved) return { success: false, provider: 'test', timestamp, error: 'SIMULACIJA: Kartica zavrnjena' }
  const cardTypes = ['VISA', 'MASTERCARD', 'MAESTRO', 'DINERS', 'AMEX']
  const cardType = cardTypes[Math.floor(Math.random() * cardTypes.length)]
  const last4 = String(Math.floor(1000 + Math.random() * 9000))
  const authCode = String(Math.floor(100000 + Math.random() * 900000))
  const txId = `TEST-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`.toUpperCase()
  return { success: true, transactionId: txId, authorizationCode: authCode, cardType, cardLast4: last4, provider: 'test', timestamp }
}
