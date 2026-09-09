// ============================================
// FURS API — Gradnja zahtevka (InvoiceRequest)
//
// URAdna oblika per Tehnična dokumentacija v3.2 (poglavje 5 + 9.1 +
// FiscalVerificationSchema.json — additionalProperties: false!):
//   InvoiceRequest/Invoice:
//     TaxNumber          — davčna št. zavezanca (številka, ne "SI..." niz)
//     IssueDateTime      — ISO lokalni čas (CET/CEST)
//     NumberingStructure — "B" (številčenje elektronske naprave) | "C"
//     InvoiceIdentifier  — { BusinessPremiseID, ElectronicDeviceID, InvoiceNumber }
//     InvoiceAmount      — skupni znesek računa
//     PaymentAmount      — plačani znesek
//     TaxesPerSeller     — [{ VAT: [{ TaxRate, TaxableAmount, TaxAmount }] }]
//     OperatorTaxNumber  — davčna št. operaterja (blagajnik)
//     ProtectedID        — ZOI (zaščitna oznaka izdajatelja)
//     SubsequentSubmit   — true za naknadno spremembo (storno/dobropis)
//     ReferenceInvoice   — [{ ReferenceInvoiceIdentifier, ReferenceInvoiceIssueDateTime }]
//
// Prej (NAPAČNO): InvoiceIdentifier = ZOI, Premises/RegisterID polja,
// PaymentType besedilno, VAT ravninski — schema tega NE pozna.
// ============================================

import crypto from 'crypto'
import type { FursConfig, FursInvoiceData } from '../types'
import { toSlovenianISO } from '../helpers'

/** Izlušči 8-mestno davčno številko iz "SI12345678" / "12345678". */
function taxNumberDigits(taxId: string): number {
  const digits = taxId.replace(/^SI/i, '').replace(/\D/g, '')
  const n = Number(digits)
  if (!Number.isFinite(n) || digits.length !== 8) {
    // FURS zahteva 8-mestno davčno št. — neveljaven input ne sme biti tiho
    // poslan kot 0 (strežnik bi zavrgel, a z nejasno napako)
    throw new Error(`Neveljavna davčna številka za FURS: "${taxId}" (pričakovanih 8 števk)`)
  }
  return n
}

export function buildFursRequest(
  config: FursConfig,
  invoiceData: FursInvoiceData,
  zoi: string,
): Record<string, unknown> {
  const dt = invoiceData.issueDateTime
  // FIX BUG-F3 CRITICAL: FURS zahteva lokalni čas (CET/CEST), ne UTC
  // toISOString() vrne UTC — uporabi slovenski čas za FURS
  const isoDateTime = toSlovenianISO(dt)

  const taxNumber = taxNumberDigits(config.taxId)
  // OperatorTaxNumber: davčna št. operaterja — app nima per-zaposleni davčne
  // št., zato uporabi davčno št. zavezanca (dovoljeno: lastnik kot operater)
  const operatorTaxNumber = taxNumber

  const isStorno = invoiceData.isStorno || false

  return {
    InvoiceRequest: {
      Header: {
        MessageID: crypto.randomUUID(),
        DateTime: isoDateTime,
      },
      Invoice: {
        TaxNumber: taxNumber,
        IssueDateTime: isoDateTime,
        // "B" = številčenje po elektronski napravi (POS blagajna)
        NumberingStructure: 'B',
        InvoiceIdentifier: {
          BusinessPremiseID: config.premisesId,
          ElectronicDeviceID: config.registerId,
          InvoiceNumber: String(invoiceData.invoiceNumber),
        },
        InvoiceAmount: invoiceData.totalAmount,
        PaymentAmount: invoiceData.totalAmount,
        TaxesPerSeller: [
          {
            VAT: invoiceData.vatBreakdown.map(vb => ({
              TaxRate: vb.rate,
              TaxableAmount: vb.baseAmount,
              TaxAmount: vb.vatAmount,
            })),
          },
        ],
        OperatorTaxNumber: operatorTaxNumber,
        ProtectedID: zoi, // ZOI — zaščitna oznaka izdajatelja (NE "InvoiceIdentifier"!)
        // Storno / naknadna sprememba (spec: SubsequentSubmit + ReferenceInvoice)
        ...(isStorno && invoiceData.referenceInvoice ? {
          SubsequentSubmit: true,
          ReferenceInvoice: [{
            ReferenceInvoiceIdentifier: {
              BusinessPremiseID: config.premisesId,
              ElectronicDeviceID: config.registerId,
              InvoiceNumber: String(invoiceData.referenceInvoice.invoiceNumber),
            },
            ReferenceInvoiceIssueDateTime: toSlovenianISO(invoiceData.referenceInvoice.issueDateTime),
          }],
        } : {}),
        // Opcijski polji (samo če prisotna — schema: additionalProperties false)
        ...(invoiceData.customerVatId ? { CustomerVATNumber: invoiceData.customerVatId } : {}),
      },
    },
  }
}
