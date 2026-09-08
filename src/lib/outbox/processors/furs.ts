// ============================================
// FURS processor — pošiljanje računov na FURS
// FIX AUDIT (CRITICAL): prej je bil procesor STUB — dogodek se je označil kot "sent"
// BREZ dejanske fiskalizacije (submitInvoice ni obstajal → fallback "queued"). Sedaj
// kličemo pravo knjižnico verifyInvoiceWithFURS iz @/lib/furs in posodobimo Receipt.
// ============================================

import { logger } from '@/lib/logger'
import { db } from '@/lib/db'
import { getFursConfig } from '@/lib/furs/config-resolver'
import { verifyInvoiceWithFURS } from '@/lib/furs/api'

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
  zoi: string // Zaščitna oznaka izdajeljca
  eor?: string // Enkratna identifikacija računa (vrne FURS)
  issueDate: string
  totalAmount: number
  taxRate: number
  taxAmount: number
  locationId?: string
  paymentMethod?: 'cash' | 'card' | 'mobile' | 'other'
  // ... polja po FURS specifikaciji
}

export async function sendToFurs(
  event: OutboxFursEvent,
): Promise<{ success: boolean; eor?: string; error?: string; isSimulation?: boolean }> {
  const payload = event.payload as FursInvoicePayload

  if (!payload.zoi) {
    throw new Error('ZOI manjka — ne morem poslati na FURS')
  }

  // Če že imamo EOR, je račun že potrjen — samo logiraj (idempotenca)
  if (payload.eor) {
    logger.info('Outbox-FURS', `Račun ${payload.orderNumber} že ima EOR ${payload.eor} — skip`)
    return { success: true, eor: payload.eor }
  }

  // 1. Pridobi FURS konfiguracijo za lokacijo (P0-C3A: per-location, ne globalno)
  const configResult = await getFursConfig(payload.locationId ?? null)
  if (!configResult.fursConfig) {
    return {
      success: false,
      error: configResult.error
        ? `FURS ni konfiguriran (vir: ${configResult.source})`
        : 'FURS ni konfiguriran za to lokacijo',
    }
  }
  const config = configResult.fursConfig

  // 2. Pridobi Receipt iz baze (avtoritativni vir za zneske + številko računa)
  const receipt = await db.receipt.findFirst({
    where: { orderId: payload.orderId, isStorno: false },
    select: {
      id: true,
      receiptNumber: true,
      createdAt: true,
      total: true,
      paymentMethod: true,
      vatBreakdown: true,
      fiscalVerified: true,
      eor: true,
    },
  })

  if (receipt?.eor) {
    // Robni primer: račun je bil medtem že overjen (npr. batch re-verifikacija)
    logger.info('Outbox-FURS', `Receipt ${receipt.receiptNumber} že ima EOR — skip (concurrent verify)`)
    return { success: true, eor: receipt.eor }
  }

  const invoiceNumber = receipt?.receiptNumber || String(payload.orderNumber)
  const issueDateTime = receipt?.createdAt ? new Date(receipt.createdAt) : new Date(payload.issueDate)
  const totalAmount = receipt?.total != null ? Number(receipt.total) : payload.totalAmount

  // DDV razčlenitev: preferiraj vatBreakdown iz Receipt (JSON string), sicer fallback na payload
  let vatBreakdown: Array<{ rate: number; baseAmount: number; vatAmount: number }> = []
  if (receipt?.vatBreakdown) {
    try {
      const parsed = typeof receipt.vatBreakdown === 'string'
        ? JSON.parse(receipt.vatBreakdown)
        : receipt.vatBreakdown
      if (Array.isArray(parsed)) {
        vatBreakdown = parsed.map((v: { rate?: unknown; baseAmount?: unknown; vatAmount?: unknown; base?: unknown; tax?: unknown }) => ({
          rate: Number(v.rate ?? 0),
          baseAmount: Number(v.baseAmount ?? v.base ?? 0),
          vatAmount: Number(v.vatAmount ?? v.tax ?? 0),
        }))
      }
    } catch {
      logger.warn('Outbox-FURS', `Neveljaven vatBreakdown JSON na Receipt ${receipt.receiptNumber} — fallback na payload`)
    }
  }
  if (vatBreakdown.length === 0 && payload.taxRate !== undefined && payload.taxAmount !== undefined) {
    vatBreakdown = [{
      rate: payload.taxRate,
      baseAmount: Math.max(0, totalAmount - payload.taxAmount),
      vatAmount: payload.taxAmount,
    }]
  }

  logger.info(
    'Outbox-FURS',
    `Pošiljam račun ${invoiceNumber} (ZOI=${payload.zoi.substring(0, 8)}...) na ${config.environment}`,
  )

  // 3. Pravi klic FURS knjižnice (JSON v1 API — OAuth2 token + verify)
  let result
  try {
    result = await verifyInvoiceWithFURS(
      config,
      {
        invoiceNumber,
        issueDateTime,
        totalAmount,
        paymentMethod: (payload.paymentMethod || (receipt?.paymentMethod as 'cash' | 'card' | 'mobile' | 'other') || 'other'),
        vatBreakdown,
      },
      payload.zoi,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('Outbox-FURS', `Napaka pri pošiljanju računa ${invoiceNumber}: ${message}`)
    return { success: false, error: message }
  }

  // 4. Posodobi Receipt z EOR-om (SAMO če je overitev uspela — simulacija ne šteje)
  if (result.success && receipt) {
    await db.receipt.update({
      where: { id: receipt.id },
      data: {
        eor: result.eor,
        fiscalVerified: true,
        fiscalStatus: 'verified',
      },
    })
    logger.info('Outbox-FURS', `Račun ${invoiceNumber} overjen — EOR=${result.eor}`)
  }

  if (!result.success) {
    // Ne označi kot sent — outbox engine bo retry-al z backoffom (fiscalStatus ostane pending)
    return {
      success: false,
      eor: result.eor,
      error: result.error || 'FURS overitev ni uspela',
      isSimulation: result.isSimulation,
    }
  }

  return { success: true, eor: result.eor, isSimulation: result.isSimulation }
}
