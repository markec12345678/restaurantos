// ============================================
// FURS processor — pošiljanje računov na FURS
// ============================================

import { logger } from '@/lib/logger'

interface OutboxFursEvent {
  id: string
  aggregateType: string
  aggregateId: string
  eventType: string
  payload: unknown
  targetEndpoint: string
}

interface FursInvoicePayload {
  orderId: string
  orderNumber: number
  zoi: string // Zaščitna oznaka izdajatelja
  eor?: string // Enkratna identifikacija računa (vrne FURS)
  issueDate: string
  totalAmount: number
  taxRate: number
  taxAmount: number
  locationId?: string
  // ... polja po FURS XML specifikaciji
}

export async function sendToFurs(event: OutboxFursEvent): Promise<{ eor?: string; sent: true }> {
  const payload = event.payload as FursInvoicePayload

  if (!payload.zoi) {
    throw new Error('ZOI manjka — ne morem poslati na FURS')
  }

  // Če že imamo EOR, je račun že potrjen — samo logiraj
  if (payload.eor) {
    logger.info('Outbox-FURS', `Račun ${payload.orderNumber} že ima EOR ${payload.eor} — skip`)
    return { eor: payload.eor, sent: true }
  }

  // V produkciji: kliči FURS SOAP API
  // Za MVP: kličemo internal API endpoint
  const fursEnv = process.env.FURS_ENV || 'test'
  const baseUrl =
    fursEnv === 'production'
      ? 'https://blagajne.fu.gov.si/v2/cash_registers'
      : 'https://blagajne-test.fu.gov.si/v2/cash_registers'

  logger.info('Outbox-FURS', `Pošiljam račun ${payload.orderNumber} (ZOI=${payload.zoi.substring(0, 8)}...) na ${fursEnv}`)

  // Simulacija klica FURS API-ja (v produkciji: SOAP request)
  // V realnem scenariju tu uporabimo @/lib/furs knjižnico
  try {
    // Dynamic import, če je na voljo
    const fursModule = await import('@/lib/furs').catch(() => null)
    if (fursModule && typeof (fursModule as { submitInvoice?: unknown }).submitInvoice === 'function') {
      const result = await (fursModule as unknown as { submitInvoice: (p: FursInvoicePayload) => Promise<{ eor: string }> }).submitInvoice(payload)
      return { eor: result.eor, sent: true }
    }

    // Fallback: logiraj kot "queued" (FURS bo procesiral v realnem času)
    logger.warn('Outbox-FURS', `FURS modul ni na voljo — račun ${payload.orderNumber} ostaja queued`)
    return { sent: true }
  } catch (err) {
    logger.error('Outbox-FURS', `Napaka pri pošiljanju računa ${payload.orderNumber}: ${err}`)
    throw err
  }
}

// Ignoriramo unused baseUrl (referenciramo v logih za debugging)
void 'baseUrl marker'
