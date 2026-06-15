// Pomožne funkcije za configuration API — Shema in konstante

import { z } from 'zod'

// Zod validacijska shema za POST body
export const configPostSchema = z.object({
  model: z.enum([
    'tax-rates', 'dining-options', 'revenue-centers', 'sales-categories',
    'price-groups', 'service-charges', 'prep-stations', 'void-reasons',
    'no-sale-reasons', 'alternate-payment-types', 'printers', 'discounts',
  ], { message: 'Neveljaven model' }),
  data: z.record(z.string().max(100, 'Ime polja je predolgo'), z.unknown()).refine(d => Object.keys(d).length > 0, { message: 'Podatki ne smejo biti prazni' }).refine(d => Object.keys(d).length <= 50, { message: 'Preveč polj — največ 50 dovoljenih' }),
})

// Bela lista dovoljenih polj za vsak model — prepreči injection polj
export const allowedFields: Record<string, string[]> = {
  'tax-rates': ['name', 'rate', 'code', 'isActive', 'sortOrder'],
  'dining-options': ['name', 'type', 'serviceChargeId', 'prepTimeMinutes', 'isActive', 'sortOrder'],
  'revenue-centers': ['name', 'code', 'isActive', 'sortOrder'],
  'sales-categories': ['name', 'code', 'isActive', 'sortOrder'],
  'price-groups': ['name', 'description', 'isActive', 'sortOrder'],
  'service-charges': ['name', 'type', 'amount', 'isAutoApply', 'isActive', 'sortOrder'],
  'prep-stations': ['name', 'type', 'avgPrepTime', 'isActive', 'sortOrder'],
  'void-reasons': ['name', 'isActive', 'sortOrder'],
  'no-sale-reasons': ['name', 'isActive', 'sortOrder'],
  'alternate-payment-types': ['name', 'code', 'type', 'isActive', 'sortOrder'],
  printers: ['name', 'type', 'location', 'ipAddress', 'printRules', 'isActive', 'sortOrder'],
  discounts: ['name', 'type', 'amount', 'appliesTo', 'triggerType', 'promoCode', 'maxUses', 'validFrom', 'validTo', 'isActive', 'sortOrder'],
}

export const modelMap: Record<string, string> = {
  'tax-rates': 'taxRate',
  'dining-options': 'diningOption',
  'revenue-centers': 'revenueCenter',
  'sales-categories': 'salesCategory',
  'price-groups': 'priceGroup',
  'service-charges': 'serviceCharge',
  'prep-stations': 'prepStation',
  'void-reasons': 'voidReason',
  'no-sale-reasons': 'noSaleReason',
  'alternate-payment-types': 'alternatePaymentType',
  printers: 'printer',
  discounts: 'discount',
}

// Prevzeti tipi za varno pretvorbo
export function coerceFieldTypes(filteredData: Record<string, unknown>): Record<string, unknown> {
  if (filteredData.rate !== undefined) filteredData.rate = Number(filteredData.rate)
  if (filteredData.amount !== undefined) filteredData.amount = Number(filteredData.amount)
  if (filteredData.sortOrder !== undefined) filteredData.sortOrder = Number(filteredData.sortOrder)
  if (filteredData.isActive !== undefined) filteredData.isActive = Boolean(filteredData.isActive)
  if (filteredData.isAutoApply !== undefined) filteredData.isAutoApply = Boolean(filteredData.isAutoApply)
  if (filteredData.avgPrepTime !== undefined) filteredData.avgPrepTime = Number(filteredData.avgPrepTime)
  if (filteredData.prepTimeMinutes !== undefined) filteredData.prepTimeMinutes = Number(filteredData.prepTimeMinutes)
  if (filteredData.maxUses !== undefined) filteredData.maxUses = Number(filteredData.maxUses) || null
  if (filteredData.validFrom !== undefined) filteredData.validFrom = filteredData.validFrom ? new Date(filteredData.validFrom as string) : null
  if (filteredData.validTo !== undefined) filteredData.validTo = filteredData.validTo ? new Date(filteredData.validTo as string) : null
  return filteredData
}
