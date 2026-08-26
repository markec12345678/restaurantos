// Pomožne funkcije za /api/furs/batch route
// Batch processing helpers

import { db } from '@/lib/db'
import { toNum } from '@/lib/decimal'
import { generateZOI, verifyInvoiceWithFURS, type FursConfig, type FursInvoiceData } from '@/lib/furs'
import { parseVatBreakdown } from '../shared'
import { logger } from '@/lib/logger'

// Zgradi FURS konfiguracijo iz nastavitev
export function buildFursConfig(settings: {
  businessId: string
  taxId: string
  registerNumber: string
  fursCertPath: string
  fursCertPassword: string
  fursEnvironment: string
  premisesId?: string
}): FursConfig {
  return {
    businessId: settings.businessId || '',
    taxId: settings.taxId || '',
    registerId: settings.registerNumber || 'BLG-001',
    premisesId: settings.premisesId || settings.businessId || '',
    deviceIp: '',
    environment: (settings.fursEnvironment === 'production' ? 'production' : 'test') as FursConfig['environment'],
    certPath: settings.fursCertPath || undefined,
    certPassword: settings.fursCertPassword || undefined,
  }
}

// Tip za rezultat obdelave enega računa
export interface BatchReceiptResult {
  receiptId: string
  receiptNumber: string
  success: boolean
  zoi?: string
  eor?: string
  isSimulation?: boolean
  error?: string
}

// Pridobi in zakleni neoverjene račune
export async function fetchAndLockUnverifiedReceipts(): Promise<string[]> {
  return db.$transaction(async (tx) => {
    // FIX F4-3c: ZDDV-1 zakonski rok 48h — pridobi VSE neoverjene račune
    // (ne glede na starost), da se zagotovi skladnost z zakonodajo.
    // Prejšnja koda je imela 30-dnevni window, kar je prekršilo 48h rok.
    const receipts = await tx.receipt.findMany({
      where: {
        fiscalVerified: false,
        fiscalStatus: { not: 'processing' },
        isStorno: false,
      },
      orderBy: { createdAt: 'asc' },  // Najstarejši prvi (najvišja prioriteta)
      take: 100,  // FIX: Povečano s 50 na 100 za hitrejši bulk processing
      select: { id: true },
    })

    if (receipts.length > 0) {
      await tx.receipt.updateMany({
        where: { id: { in: receipts.map(r => r.id) } },
        data: { fiscalStatus: 'processing' },
      })
    }

    return receipts.map(r => r.id)
  })
}

// Obdelaj posamezen račun v batchu
export async function processBatchReceipt(
  receipt: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  settings: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  config: FursConfig,
  privateKey: Buffer | undefined,
): Promise<BatchReceiptResult> {
  try {
    const zoi = generateZOI({
      taxId: settings.taxId,
      invoiceNumber: receipt.receiptNumber,
      issueDateTime: receipt.createdAt,
      totalAmount: toNum(receipt.total),
      premisesId: config.premisesId,
      registerId: settings.registerNumber,
      environment: config.environment,
    }, privateKey || undefined)

    const vatBreakdown = parseVatBreakdown(receipt.vatBreakdown as string, toNum(receipt.total), 22)

    const invoiceData: FursInvoiceData = {
      invoiceNumber: receipt.receiptNumber,
      issueDateTime: receipt.createdAt,
      totalAmount: toNum(receipt.total),
      paymentMethod: (receipt.paymentMethod === 'cash' ? 'cash' :
                      receipt.paymentMethod === 'card' ? 'card' :
                      receipt.paymentMethod === 'mobile' ? 'mobile' : 'other') as FursInvoiceData['paymentMethod'],
      vatBreakdown,
    }

    const result = await verifyInvoiceWithFURS(config, invoiceData, zoi)

    if (result.success) {
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

      return {
        receiptId: receipt.id,
        receiptNumber: receipt.receiptNumber,
        success: true,
        zoi: result.zoi,
        eor: result.eor,
        isSimulation: result.isSimulation,
      }
    } else {
      // Reset fiscalStatus from 'processing' back to 'pending'
      await db.receipt.update({
        where: { id: receipt.id },
        data: { fiscalStatus: 'pending' },
      })

      return {
        receiptId: receipt.id,
        receiptNumber: receipt.receiptNumber,
        success: false,
        error: result.error || 'Napaka pri overjanju',
      }
    }
  } catch (err: unknown) {
    // Reset fiscalStatus from 'processing' back to 'pending'
    try {
      await db.receipt.update({
        where: { id: receipt.id },
        data: { fiscalStatus: 'pending' },
      })
    } catch { /* ignore reset failure */ }
    logger.error('API', `FURS batch error for receipt ${receipt.receiptNumber}:`, err)
    return {
      receiptId: receipt.id,
      receiptNumber: receipt.receiptNumber,
      success: false,
      error: 'Napaka pri overjanju računa',
    }
  }
}
