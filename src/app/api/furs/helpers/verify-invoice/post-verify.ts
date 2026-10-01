// =====================================================================
// FURS Verify Invoice - Post-overitvene operacije (zaloga, QR, audit, webhooks)
// =====================================================================

import { db, createAuditLog } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { generateFursQRContent, type FursConfig } from '@/lib/furs'
import { deductStockForOrder, broadcastLowStockAlert } from '@/lib/stock-deduction'
import { emitReceiptCreated, emitReceiptFiscalVerified } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'
import type { Receipt, RestaurantSettings } from '@prisma/client'
import type { VerifyOrder } from './validate-and-submit'

// Obdelaj uspešno overitev — shrani, razknjiži zalogo, QR, audit
export async function handleSuccessfulVerification(
  receipt: Receipt,
  order: VerifyOrder,
  settings: RestaurantSettings,
  config: FursConfig,
  zoi: string,
  result: { zoi: string; eor: string; verifiedAt: Date; isSimulation: boolean; environment: string },
  employeeId: string | undefined,
) {
  // Shrani overitev
  await db.receipt.update({
    where: { id: receipt.id },
    data: {
      zoi: result.zoi,
      eor: result.eor,
      fiscalVerified: true,
      fiscalStatus: 'verified',
      verificationDate: result.verifiedAt,
    },
  })

  // Razknjiževanje zaloge (fallback)
  const freshOrder = await db.order.findUnique({ where: { id: order.id } })
  if (freshOrder && !freshOrder.inventoryDeducted) {
    const stockResult = await deductStockForOrder(
      order.id,
      order.orderNumber,
      order.orderItems.map((oi) => ({
        menuItemId: oi.menuItemId,
        quantity: oi.quantity,
        voided: oi.voided,
      }))
    )
    if (stockResult.lowStockAlerts.length > 0) {
      broadcastLowStockAlert(stockResult.lowStockAlerts)
    }
  }

  // QR koda
  const qrContent = generateFursQRContent({
    zoi: result.zoi,
    totalAmount: toNum(receipt.total),
    issueDateTime: receipt.createdAt,
    taxId: settings.taxId,
    businessId: settings.businessId,
    registerId: settings.registerNumber,
    premisesId: config.premisesId,
  })

  // Revizijski dnevnik
  await createAuditLog({
    userId: employeeId,
    action: 'FURS_VERIFY_SUCCESS',
    entityType: 'Receipt',
    entityId: receipt.id,
    details: { zoi: result.zoi, eor: result.eor, isSimulation: result.isSimulation, environment: result.environment },
  })

  // Webhooks
  // R83: locationId pass-through (order.locationId) — tenant isolation v webhook delivery
  emitReceiptFiscalVerified({ receiptId: receipt.id, zoi: result.zoi, eor: result.eor, locationId: order.locationId ?? null })
    .catch(err => logger.error('API', '[Webhook] receipt.fiscal_verified napaka:', err))
  emitReceiptCreated({ receiptId: receipt.id, receiptNumber: receipt.receiptNumber, orderId: receipt.orderId, total: toNum(receipt.total), locationId: order.locationId ?? null })
    .catch(err => logger.error('API', '[Webhook] receipt.created napaka:', err))

  return qrContent
}

// Obdelaj neuspešno overitev
export async function handleFailedVerification(
  receipt: Receipt,
  zoi: string,
  result: { error?: string; isSimulation: boolean },
  employeeId: string | undefined,
) {
  await db.receipt.update({
    where: { id: receipt.id },
    data: { fiscalVerified: false, fiscalStatus: 'pending' },
  })

  await createAuditLog({
    userId: employeeId,
    action: 'FURS_VERIFY_FAILED',
    entityType: 'Receipt',
    entityId: receipt.id,
    details: { zoi, error: result.error, isSimulation: result.isSimulation },
  })
}

// Obdelaj nepričakovano napako (receipt je lahko null — BUG-08 kontrakt iz core.ts)
export async function handleVerificationError(
  receipt: Receipt | null,
  error: unknown,
) {
  if (receipt?.id) {
    try {
      await db.receipt.update({
        where: { id: receipt.id },
        data: { fiscalVerified: false, fiscalStatus: 'pending' },
      })
    } catch { /* Receipt update failed */ }
  }

  await createAuditLog({
    userId: undefined,
    action: 'FURS_VERIFY_ERROR',
    entityType: 'Receipt',
    details: { error: String(error) },
  })
}

// Generiraj QR za že overjen račun
export function generateQRForVerifiedReceipt(
  receipt: Receipt,
  settings: RestaurantSettings,
  config: FursConfig,
) {
  return generateFursQRContent({
    zoi: receipt.zoi,
    totalAmount: toNum(receipt.total),
    issueDateTime: receipt.createdAt,
    taxId: settings.taxId,
    businessId: settings.businessId,
    registerId: settings.registerNumber,
    premisesId: config.premisesId,
  })
}
