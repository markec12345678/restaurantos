// =====================================================================
// FURS Verify Invoice - Glavna funkcija (orkestracija)
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { verifyInvoiceWithFURS } from '@/lib/furs'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/api-utils'
import { validateAndFetchData, submitToFurs } from './validate-and-submit'
import {
  handleSuccessfulVerification,
  handleFailedVerification,
  handleVerificationError,
  generateQRForVerifiedReceipt,
} from './post-verify'

export async function verifyInvoice(req: Request): Promise<Response> {
  // FIX BUG-08: receipt mora biti dostopen v catch bloku
  let receipt: Awaited<ReturnType<typeof db.receipt.findFirst>> = null
  try {
    try {
      const validationResult = await validateAndFetchData(req)
      if (validationResult instanceof Response) return validationResult

      const { order, receipt: fetchedReceipt, settings, config, authResult } = validationResult
      receipt = fetchedReceipt

      // Če je račun že overjen, vrni QR kodo
      if (receipt!.fiscalVerified) {
        const qrContent = generateQRForVerifiedReceipt(receipt!, settings, config)
        return NextResponse.json({
          success: true,
          zoi: receipt!.zoi,
          eor: receipt!.eor,
          fiscalVerified: true,
          verificationDate: receipt!.verificationDate?.toISOString(),
          qrContent,
          message: 'Račun je že davčno overjen',
        })
      }

      // Generiraj ZOI in pripravi podatke za FURS
      const submitResult = await submitToFurs(receipt!, settings, config)
      if (submitResult instanceof Response) return submitResult

      const { zoi, invoiceData } = submitResult

      // Pošlji na FURS
      const result = await verifyInvoiceWithFURS(config, invoiceData, zoi)

      if (!result.success) {
        await handleFailedVerification(receipt!, zoi, result, authResult.session?.employeeId)

        const failResponse = NextResponse.json({
          success: false,
          zoi,
          eor: '',
          fiscalVerified: false,
          fiscalStatus: 'pending',
          isSimulation: result.isSimulation,
          error: result.error || 'Napaka pri FURS overjanju',
          warning: 'FISKALIZACIJA NI USPELA — Račun je označen kot pending. Ponovite overitev čim prej!',
        }, { status: 400 })
        failResponse.headers.set('X-Fiscal-Warning', 'Fiscalization pending - receipt requires manual re-verification')
        return failResponse
      }

      // Uspešna overitev
      const qrContent = await handleSuccessfulVerification(
        receipt!, order, settings, config, zoi, result, authResult.session?.employeeId,
      )

      return NextResponse.json({
        success: true,
        zoi: result.zoi,
        eor: result.eor,
        fiscalVerified: true,
        verificationDate: result.verifiedAt.toISOString(),
        receiptNumber: receipt!.receiptNumber,
        isSimulation: result.isSimulation,
        environment: result.environment,
        qrContent,
        message: result.isSimulation
          ? `Račun davčno overjen (SIMULACIJA) v ${result.environment === 'test' ? 'TESTNEM' : 'PRODUKCIJSKEM'} okolju`
          : `Račun davčno overjen v ${result.environment === 'test' ? 'TESTNEM' : 'PRODUKCIJSKEM'} okolju`,
      })
    } catch (error: unknown) {
      logger.error('API', 'FURS verification error:', error)

      // FIX BUG-08: Označi račun kot pending
      await handleVerificationError(receipt, error)

      const errorResponse = NextResponse.json({
        error: 'Napaka pri davčnem overjanju računa',
        fiscalStatus: 'pending',
        warning: 'FISKALIZACIJA NI USPELA — Račun je označen kot pending. Ponovite overitev čim prej!',
      }, { status: 500 })
      errorResponse.headers.set('X-Fiscal-Warning', 'Fiscalization pending - receipt requires manual re-verification')
      return errorResponse
    }
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/furs', 'Napaka pri overjanju računa')
  }
}
