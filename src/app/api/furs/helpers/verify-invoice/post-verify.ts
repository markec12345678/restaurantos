// =====================================================================
// FURS Verify Invoice - Post-overitvene operacije (zaloga, QR, audit, webhooks)
// =====================================================================

import { db, createAuditLog } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { generateFursQRContent } from '@/lib/furs'
import { deductStockForOrder, broadcastLowStockAlert } from '@/lib/stock-deduction'
import { emitReceiptCreated, emitReceiptFiscalVerified } from '@/lib/event-emitter'
import { logger } from '@/lib/logger'

// Obdelaj uspešno overitev — shrani, razknjiži zalogo, QR, audit
export async function handleSuccessfulVerification(
  receipt: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  order: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  settings: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  config: any, // eslint-disable-line @typescript-eslint/no-explicit-any
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
      order.orderItems.map((oi: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
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
  emitReceiptFiscalVerified({ receiptId: receipt.id, zoi: result.zoi, eor: result.eor })
    .catch(err => logger.error('API', '[Webhook] receipt.fiscal_verified napaka:', err))
  emitReceiptCreated({ receiptId: receipt.id, receiptNumber: receipt.receiptNumber, orderId: receipt.orderId, total: toNum(receipt.total) })
    .catch(err => logger.error('API', '[Webhook] receipt.created napaka:', err))

  return qrContent
}

// Obdelaj neuspešno overitev
export async function handleFailedVerification(
  receipt: any, // eslint-disable-line @typescript-eslint/no-explicit-any
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

// Obdelaj nepričakovano napako
export async function handleVerificationError(
  receipt: any, // eslint-disable-line @typescript-eslint/no-explicit-any
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
  receipt: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  settings: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  config: any, // eslint-disable-line @typescript-eslint/no-explicit-any
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
