// =====================================================================
// FURS Storno Invoice - Glavna funkcija (orkestracija)
// =====================================================================

import { NextResponse } from 'next/server'
import { deepToNumbers } from '@/lib/decimal'
import { handleApiError } from '@/lib/api-utils'
import { validateAndSubmitStorno } from './validate-and-submit'
import { executeStornoTransaction, handlePostStorno } from './storno-transaction'

export async function stornoInvoice(req: Request): Promise<Response> {
  try {
    const validationResult = await validateAndSubmitStorno(req)
    if (validationResult instanceof Response) return validationResult

    const {
      receipt, settings: _settings, config, stornoNumber, zoi, fursResult,
      authResult, reason, reasonCode, vatBreakdownForStorno,
    } = validationResult

    // FIX F08 HIGH: Če FURS overitev storna NE uspe, NE označi originala kot storniranega
    // FIX Test 5.3: V testnem okolju z FURS_ALLOW_SIMULATION=true dovoli simulirano storno
    // (fursResult.isSimulation=true in fursResult.success=false je pričakovan v simulaciji)
    const allowSimulationStorno = process.env.FURS_ALLOW_SIMULATION === 'true' && fursResult.isSimulation

    if (!fursResult.success && !allowSimulationStorno) {
      const { createAuditLog } = await import('@/lib/db')
      await createAuditLog({
        userId: authResult.session?.employeeId,
        action: 'FURS_STORNO_FAILED',
        entityType: 'Receipt',
        entityId: receipt.id,
        details: {
          stornoNumber,
          originalReceiptNumber: receipt.receiptNumber,
          reason: reason || reasonCode,
          fursError: fursResult.error,
          isSimulation: fursResult.isSimulation,
        },
      })

      return NextResponse.json({
        success: false,
        error: 'FURS overitev storno računa ni uspela — storno NI bilo izvedeno.',
        fursError: fursResult.error,
        isSimulation: fursResult.isSimulation,
        warning: 'STORNO NI IZVEDENO — FURS overitev ni uspela. Poskusite znova.',
      }, { status: 400 })
    }

    // FURS overitev storna je uspela — nadaljuj s transakcijo
    // FIX Test 5.3: Če dovoljujemo simulirano storno, označi kot success
    const effectiveFursResult = allowSimulationStorno
      ? { ...fursResult, success: true }
      : fursResult

    const stornoReceipt = await executeStornoTransaction(
      receipt, stornoNumber, effectiveFursResult, zoi,
      vatBreakdownForStorno, reason, reasonCode,
      authResult.session?.employeeId,
    )

    // Vrni zalogo, audit, QR
    const qrContent = await handlePostStorno(
      receipt, stornoReceipt, stornoNumber, reason, reasonCode,
      effectiveFursResult, zoi, config, authResult.session?.employeeId,
    )

    return NextResponse.json(deepToNumbers({
      success: true,
      stornoReceipt,
      originalReceiptNumber: receipt.receiptNumber,
      stornoReason: reason || reasonCode,
      isSimulation: fursResult.isSimulation,
      qrContent,
      message: `Storno račun ${stornoNumber} ustvarjen za račun ${receipt.receiptNumber}${fursResult.isSimulation ? ' (SIMULACIJA)' : ''}`,
    }))
  } catch (error: unknown) {
    return handleApiError(error, 'PUT /api/furs', 'Napaka pri storniranju računa')
  }
}
