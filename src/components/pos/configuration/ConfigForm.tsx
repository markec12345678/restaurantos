'use client'
import React from 'react'
import { TaxRateForm, DiningOptionForm, RevenueCenterForm, SalesCategoryForm, PriceGroupForm, ServiceChargeForm, PrepStationForm, VoidReasonForm, NoSaleReasonForm } from './SimpleForms'
import { AltPaymentTypeForm, PrinterForm, DiscountForm, GiftCardForm, LoyaltyForm, WebhookForm } from './ExtendedForms'

// ============================================
// OBRAZEC ZA UREJANJE - Registr obrazcev po tabKey
// ============================================
export function ConfigForm({
  tabKey,
  formData,
  setFormData,
}: {
  tabKey: string
  formData: Record<string, unknown>
  setFormData: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
}) {
  const update = (key: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const formProps = { formData, update }

  switch (tabKey) {
    case 'tax-rates':
      return <TaxRateForm {...formProps} />
    case 'dining-options':
      return <DiningOptionForm {...formProps} />
    case 'revenue-centers':
      return <RevenueCenterForm {...formProps} />
    case 'sales-categories':
      return <SalesCategoryForm {...formProps} />
    case 'price-groups':
      return <PriceGroupForm {...formProps} />
    case 'service-charges':
      return <ServiceChargeForm {...formProps} />
    case 'prep-stations':
      return <PrepStationForm {...formProps} />
    case 'void-reasons':
      return <VoidReasonForm {...formProps} />
    case 'no-sale-reasons':
      return <NoSaleReasonForm {...formProps} />
    case 'alt-payment-types':
      return <AltPaymentTypeForm {...formProps} />
    case 'printers':
      return <PrinterForm {...formProps} />
    case 'discounts':
      return <DiscountForm {...formProps} />
    case 'gift-cards':
      return <GiftCardForm {...formProps} />
    case 'loyalty':
      return <LoyaltyForm {...formProps} />
    case 'webhooks':
      return <WebhookForm {...formProps} />
    default:
      return <p className="text-muted-foreground">Neznana konfiguracija</p>
  }
}
