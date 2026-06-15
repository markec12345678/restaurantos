'use client'

import { memo } from 'react'
import type { TaxTabProps } from './constants'
import { VatRatesCard } from './tax-tab/VatRatesCard'
import { BulkVatChangeCard } from './tax-tab/BulkVatChangeCard'
import { CurrencyLanguageCard } from './tax-tab/CurrencyLanguageCard'

// --- Komponenta ---

export const TaxTab = memo(function TaxTab({
  form,
  updateField,
  currentCountryCode,
  bulkVatFrom,
  bulkVatTo,
  setBulkVatFrom,
  setBulkVatTo,
  onBulkVatChange,
  bulkVatPending,
}: TaxTabProps) {
  return (
    <>
      <VatRatesCard
        form={form}
        updateField={updateField}
        currentCountryCode={currentCountryCode}
      />

      {/* Sprememba DDV za vse artikle */}
      <BulkVatChangeCard
        bulkVatFrom={bulkVatFrom}
        bulkVatTo={bulkVatTo}
        setBulkVatFrom={setBulkVatFrom}
        setBulkVatTo={setBulkVatTo}
        onBulkVatChange={onBulkVatChange}
        bulkVatPending={bulkVatPending}
      />

      {/* Valuta in jezik */}
      <CurrencyLanguageCard
        form={form}
        updateField={updateField}
      />
    </>
  )
})
