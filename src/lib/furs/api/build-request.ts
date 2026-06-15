// ============================================
// FURS API — Gradnja zahtevka
// Pripravi JSON body za FURS cash_payments API
// ============================================

import crypto from 'crypto'
import type { FursConfig, FursInvoiceData } from '../types'
import { toSlovenianISO } from '../helpers'

// ============================================
// FURS ZAHTETEK — JSON FORMAT
// ============================================

export function buildFursRequest(
  config: FursConfig,
  invoiceData: FursInvoiceData,
  zoi: string,
): Record<string, unknown> {
  const dt = invoiceData.issueDateTime
  // FIX BUG-F3 CRITICAL: FURS zahteva lokalni čas (CET/CEST), ne UTC
  // toISOString() vrne UTC — uporabi slovenski čas za FURS
  const isoDateTime = toSlovenianISO(dt)

  // FIX BUG-F4 CRITICAL: PaymentType mora biti FURS enumeracija, ne angleške besede
  // FURS v1 spec: "CashPayment" | "PaymentCard" | "Other"
  const paymentTypeMap: Record<string, string> = {
    cash: 'CashPayment',
    card: 'PaymentCard',
    mobile: 'Other',
    other: 'Other',
  }
  const fursPaymentType = paymentTypeMap[invoiceData.paymentMethod] || 'Other'

  // FIX BUG1: Use explicit isStorno flag instead of parsing customerName
  // FIX BUG-F5 HIGH: Manjka InvoiceType — FURS zahteva za storno račune
  // 0 = redni račun, 1 = storno račun
  const isStorno = invoiceData.isStorno || false

  return {
    InvoiceRequest: {
      Header: {
        MessageID: crypto.randomUUID(),
        DateTime: isoDateTime,
      },
      Invoice: {
        TaxNumber: config.taxId.replace('SI', ''),
        IssueDateTime: isoDateTime,
        InvoiceNumber: invoiceData.invoiceNumber,
        InvoiceIdentifier: zoi,
        InvoiceType: isStorno ? 1 : 0, // FIX BUG-F5: 0=redni, 1=storno
        Premises: {
          PremisesID: config.premisesId,
          RegisterID: config.registerId,
        },
        InvoiceAmount: invoiceData.totalAmount,
        PaymentType: fursPaymentType, // FIX BUG-F4: Pravilne FURS vrednosti
        VAT: invoiceData.vatBreakdown.map(vb => ({
          TaxRate: vb.rate,
          TaxableAmount: vb.baseAmount,
          TaxAmount: vb.vatAmount,
        })),
        CustomerVATNumber: invoiceData.customerVatId || undefined,
        CustomerName: invoiceData.customerName || undefined,
        // FIX BUG1: Proper ReferenceInvoice structure for storno — FURS requires original ZOI and issue date
        ...(isStorno && invoiceData.referenceInvoice ? {
          ReferenceInvoice: {
            ReferenceInvoiceNumber: invoiceData.referenceInvoice.invoiceNumber,
            ReferenceInvoiceIdentifier: invoiceData.referenceInvoice.zoi,
            ReferenceIssueDateTime: toSlovenianISO(invoiceData.referenceInvoice.issueDateTime),
          }
        } : {}),
      },
    },
  }
}
