// ============================================
// UBL 2.1 / PEPPOL BIS 3.0 E-INVOICING GENERATOR
// EU 2026 mandat: Belgija, Nemčija, Hrvaška (B2B e-invoicing obvezno)
// Format: UBL 2.1 Invoice (ISO/IEC 19845)
// ============================================

import type { ReportData } from './report-data'

const escapeXml = (s: string | number): string =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const fmtDate = (d: Date): string => d.toISOString().split('T')[0]

interface UblOptions {
  supplierName: string
  supplierTaxId: string
  supplierAddress: string
  supplierCity: string
  supplierCountry: string
  customerName?: string
  customerTaxId?: string
  invoiceNumber: string
  currency?: string
}

/**
 * Generiraj UBL 2.1 Invoice XML (PEPPOL BIS 3.0 kompatibilen)
 * Za EU B2B e-invoicing mandat 2026 (Belgija, Nemčija, Hrvaška)
 */
export function generateUblInvoice(data: ReportData, opts: UblOptions): string {
  const currency = opts.currency || 'EUR'
  const issueDate = fmtDate(new Date(data.generatedAt))
  const dueDate = fmtDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))

  const taxSubtotals = data.vatBreakdown.map(v => `      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="${currency}">${v.baseAmount.toFixed(2)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="${currency}">${v.vatAmount.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:ID schemeID="UNCL5305">${v.code === 'S' ? 'S' : v.code === 'R' ? 'AA' : 'Z'}</cbc:ID>
          <cbc:Percent>${v.rate.toFixed(2)}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID schemeID="UN/ECE 5153">VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>`).join('\n')

  // Invoice lines (po DDV stopnjah)
  const invoiceLines = data.vatBreakdown.map((v, i) => `    <cac:InvoiceLine>
      <cbc:ID>${i + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="C62">${data.summary.totalOrders}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${currency}">${v.baseAmount.toFixed(2)}</cbc:LineExtensionAmount>
      <cbc:TaxTotal>
        <cbc:TaxAmount currencyID="${currency}">${v.vatAmount.toFixed(2)}</cbc:TaxAmount>
      </cbc:TaxTotal>
      <cac:Item>
        <cbc:Description>${escapeXml(v.label)}</cbc:Description>
        <cbc:Name>${escapeXml(v.label)}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:ID schemeID="UNCL5305">${v.code === 'S' ? 'S' : v.code === 'R' ? 'AA' : 'Z'}</cbc:ID>
          <cbc:Percent>${v.rate.toFixed(2)}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID schemeID="UN/ECE 5153">VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="${currency}">${v.baseAmount.toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${escapeXml(opts.invoiceNumber)}</cbc:ID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:DueDate>${dueDate}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>
  <cbc:AccountingCost>${escapeXml(data.startDate || '')}-${escapeXml(data.endDate || '')}</cbc:AccountingCost>
  <cac:OrderReference>
    <cbc:ID>POS-DAILY-${issueDate}</cbc:ID>
  </cac:OrderReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0208">${escapeXml(opts.supplierTaxId)}</cbc:EndpointID>
      <cac:PartyName>
        <cbc:Name>${escapeXml(opts.supplierName)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(opts.supplierAddress)}</cbc:StreetName>
        <cbc:CityName>${escapeXml(opts.supplierCity)}</cbc:CityName>
        <cac:Country>
          <cbc:IdentificationCode>${escapeXml(opts.supplierCountry)}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(opts.supplierTaxId)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0208">${escapeXml(opts.customerTaxId || opts.supplierTaxId)}</cbc:EndpointID>
      <cac:PartyName>
        <cbc:Name>${escapeXml(opts.customerName || opts.supplierName)}</cbc:Name>
      </cac:PartyName>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:Delivery>
    <cbc:ActualDeliveryDate>${issueDate}</cbc:ActualDeliveryDate>
  </cac:Delivery>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    <cbc:PaymentDueDate>${dueDate}</cbc:PaymentDueDate>
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">${data.summary.totalTax.toFixed(2)}</cbc:TaxAmount>
${taxSubtotals}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currency}">${(data.summary.totalRevenue - data.summary.totalTax).toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${currency}">${(data.summary.totalRevenue - data.summary.totalTax).toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${currency}">${data.summary.totalRevenue.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="${currency}">${data.summary.totalDiscount.toFixed(2)}</cbc:AllowanceTotalAmount>
    <cbc:PayableAmount currencyID="${currency}">${data.summary.totalRevenue.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${invoiceLines}
</Invoice>`
}
