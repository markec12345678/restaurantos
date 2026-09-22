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

      // FIX R111 (FURS-1, HIGH — TOCTOU razred iz R100–R110): prej je bil
      // verify tok check-then-act brez zaklepa: fetch receipt (fiscalVerified
      // false) → ZUNANJI FURS klic (sekunde!) → NEPOGOJEN update. Dva
      // sočasna verify-a za isti račun = OBADVA poslana na FURS → DVA EOR-ja
      // za isti račun (fiskalna kršitev — ZDDV-1 enoličnost) + last-writer-
      // wins na receipt vrstici. Storno pot (PUT) že ima claim updateMany
      // (isStorno false→true PRED klicem) — verify ga ni imel.
      // Sedaj: CAS claim PRED zunanjim klicem — updateMany
      // { fiscalVerified: false, fiscalStatus: { not: 'verifying' } }
      // → count 0 = nekdo drug že overja / je overil. Re-read: že overjen →
      // idempotenten 200 (isti JSON kot fast-path zgoraj); sicer → 409
      // in-flight. Stale claim (proces padel med 'verifying') se po 2 min
      // lahko prevzame (crash recovery) — updatedAt @updatedAt.
      const staleClaimBefore = new Date(Date.now() - 2 * 60 * 1000)
      const claim = await db.receipt.updateMany({
        where: {
          id: receipt!.id,
          fiscalVerified: false,
          OR: [
            { fiscalStatus: { not: 'verifying' } },
            { fiscalStatus: 'verifying', updatedAt: { lt: staleClaimBefore } },
          ],
        },
        data: { fiscalStatus: 'verifying' },
      })
      if (claim.count === 0) {
        const fresh = await db.receipt.findUnique({ where: { id: receipt!.id } })
        if (fresh?.fiscalVerified) {
          // Idempotentna pariteta s fast-pathom — drugi zahtevek je zmagal
          // med našim fetchom in claimom
          const qrContent = generateQRForVerifiedReceipt(fresh, settings, config)
          return NextResponse.json({
            success: true,
            zoi: fresh.zoi,
            eor: fresh.eor,
            fiscalVerified: true,
            verificationDate: fresh.verificationDate?.toISOString(),
            qrContent,
            message: 'Račun je že davčno overjen',
          })
        }
        return NextResponse.json(
          { error: 'Davčna overitev že poteka (sočasni zahtevek). Poskusite čez trenutek.' },
          { status: 409 },
        )
      }

      // Generiraj ZOI in pripravi podatke za FURS (claim je državnik —
      // konkurirajoči verify-i ne pridejo sem)
      const submitResult = await submitToFurs(receipt!, settings, config)
      if (submitResult instanceof Response) {
        // FIX R111: release claima — ZOI/priprava je padla (npr. certifikat),
        // receipt ne sme ostati 'verifying' ( stale reclaim čaka 2 min brez
        // tega); naslednji poskus je takoj možen.
        await db.receipt.updateMany({
          where: { id: receipt!.id, fiscalVerified: false },
          data: { fiscalStatus: 'pending' },
        }).catch(() => {})
        return submitResult
      }

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
