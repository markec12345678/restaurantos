// ============================================
// NASTAVITVE (Settings) — Posodabljanje nastavitev restavracije
// ============================================

import { z } from 'zod'

export const updateSettingsSchema = z.object({
  name: z.string().max(200).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  postCode: z.string().max(20).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().max(200).optional(),
  web: z.string().max(200).optional(),
  businessId: z.string().max(50).optional(),
  taxId: z.string().max(50).optional(),
  registerNumber: z.string().max(50).optional(),
  fursCertPath: z.string().max(500).optional(),
  fursCertPassword: z.string().max(200).optional(),
  fursEnvironment: z.enum(['test', 'production']).optional(),
  defaultVatRate: z.number().min(0).max(100).optional(),
  reducedVatRate: z.number().min(0).max(100).optional(),
  loyaltyEnabled: z.boolean().optional(),
  loyaltyPointsPerEuro: z.number().int().min(0).optional(),
  loyaltyPointsValue: z.number().min(0).optional(),
  receiptFooter: z.string().max(1000).optional(),
  currency: z.string().max(10).optional(),
  locale: z.string().max(10).optional(),
  country: z.enum(['SI', 'HR', 'IT', 'AT', 'DE']).optional(),
})
