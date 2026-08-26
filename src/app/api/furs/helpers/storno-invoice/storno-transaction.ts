// =====================================================================
// FURS Storno Invoice - Transakcija in post-storno operacije
// =====================================================================

import { db, createAuditLog } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { generateFursQRContent } from '@/lib/furs'
import { returnStockForOrder, broadcastLowStockAlert } from '@/lib/stock-deduction'

// Izvedi storno transakcijo v bazi
export async function executeStornoTransaction(
  originalReceipt: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  stornoNumber: string,
  fursResult: { zoi?: string; eor?: string; success: boolean; verifiedAt?: Date },
  zoi: string,
  vatBreakdownForStorno: Record<string, { base: number; vat: number }>,
  reason: string,
  reasonCode: string,
  employeeId: string | undefined,
) {
  const stornoReceipt = await db.$transaction(async (tx) => {
    const newStornoReceipt = await tx.receipt.create({
      data: {
        receiptNumber: String(stornoNumber),
        orderId: originalReceipt.orderId,
        businessName: originalReceipt.businessName,
        businessAddress: originalReceipt.businessAddress,
        businessId: originalReceipt.businessId,
        taxId: originalReceipt.taxId,
        registerId: originalReceipt.registerId,
        zoi: fursResult.zoi || zoi,
        eor: fursResult.eor || '',
        fiscalVerified: fursResult.success,
        verificationDate: fursResult.verifiedAt,
        subtotal: originalReceipt.subtotal.negated(),
        vatBreakdown: JSON.stringify(
          Object.fromEntries(
            Object.entries(vatBreakdownForStorno).map(([rate, data]) => [
              rate,
              { base: -(data as { base: number; vat: number }).base, vat: -(data as { base: number; vat: number }).vat }
            ])
          )
        ),
        totalVat: originalReceipt.totalVat.negated(),
        discount: originalReceipt.discount.negated(),
        total: originalReceipt.total.negated(),
        tip: originalReceipt.tip.negated(),
        totalWithTip: originalReceipt.totalWithTip.negated(),
        paymentMethod: originalReceipt.paymentMethod,
        isCopy: false,
        isStorno: true,
        stornoOf: originalReceipt.receiptNumber,
      },
    })

    // Označi original kot storniran
    await tx.receipt.update({
      where: { id: originalReceipt.id },
      data: { isStorno: true },
    })

    // Posodobi naročilo
    await tx.order.update({
      where: { id: originalReceipt.orderId },
      data: {
        paymentStatus: 'storno',
        status: 'cancelled',
        cancelReason: `STORNO: ${reason || reasonCode}`,
        cancelledAt: new Date(),
        cancelledBy: employeeId || '',
      },
    })

    // Označi plačila kot refunded
    const checks = await tx.check.findMany({ where: { orderId: originalReceipt.orderId } })
    for (const check of checks) {
      await tx.payment.updateMany({
        where: { checkId: check.id },
        data: { status: 'refunded' },
      })
    }

    return newStornoReceipt
  })

  return stornoReceipt
}

// Vrni zalogo in ustvari audit log
export async function handlePostStorno(
  receipt: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  stornoReceipt: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  stornoNumber: string,
  reason: string,
  reasonCode: string,
  fursResult: { isSimulation: boolean; zoi?: string },
  zoi: string,
  config: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  employeeId: string | undefined,
) {
  // Vrni zalogo
  const stornoOrder = await db.order.findUnique({ where: { id: receipt.orderId } })
  if (stornoOrder && stornoOrder.inventoryDeducted) {
    const returnResult = await returnStockForOrder(
      receipt.orderId,
      stornoOrder.orderNumber,
      `STORNO: ${reason || reasonCode}`
    )
    if (returnResult.lowStockAlerts.length > 0) {
      broadcastLowStockAlert(returnResult.lowStockAlerts)
    }
  }

  // Revizijski dnevnik
  await createAuditLog({
    userId: employeeId,
    action: 'FURS_STORNO',
    entityType: 'Receipt',
    entityId: stornoReceipt.id,
    details: {
      stornoNumber,
      originalReceiptNumber: receipt.receiptNumber,
      reason: reason || reasonCode,
      isSimulation: fursResult.isSimulation,
    },
  })

  // QR koda za storno
  const qrContent = generateFursQRContent({
    zoi: fursResult.zoi || zoi,
    totalAmount: toNum(receipt.total),
    issueDateTime: stornoReceipt.createdAt,
    taxId: config.taxId,
    businessId: config.businessId,
    registerId: config.registerId,
    premisesId: config.premisesId,
  })

  return qrContent
}
