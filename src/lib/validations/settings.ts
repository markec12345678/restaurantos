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
  // FIX issue #51: emailSmtpPassword je bil manjkal v Zod shemi — TypeScript error
  emailSmtpHost: z.string().max(200).optional(),
  emailSmtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  emailSmtpUser: z.string().max(200).optional(),
  emailSmtpPassword: z.string().max(200).optional(),
  emailFromAddress: z.string().max(200).optional(),
  emailReportRecipients: z.string().max(2000).optional(),
  emailEnabled: z.boolean().optional(),
  defaultVatRate: z.number().min(0).max(100).optional(),
  reducedVatRate: z.number().min(0).max(100).optional(),
  loyaltyEnabled: z.boolean().optional(),
  loyaltyPointsPerEuro: z.number().int().min(0).optional(),
  loyaltyPointsValue: z.number().min(0).optional(),
  receiptFooter: z.string().max(1000).optional(),
  currency: z.string().max(10).optional(),
  locale: z.string().max(10).optional(),
  country: z.enum(['SI', 'HR', 'IT', 'AT', 'DE']).optional(),
  // ─── AI nastavitve (P14 — shranjuje se v apiKeys JSON field) ───
  geminiApiKey: z.string().max(200).optional(),
  aiForecastEnabled: z.boolean().optional(),
  aiAssistantEnabled: z.boolean().optional(),
  aiVoiceOrderEnabled: z.boolean().optional(),
  // ─── Integracije (P14 — shranjuje se v apiKeys JSON field) ───
  stripePublishableKey: z.string().max(200).optional(),
  stripeSecretKey: z.string().max(200).optional(),
  stripeWebhookSecret: z.string().max(200).optional(),
  twilioAccountSid: z.string().max(100).optional(),
  twilioAuthToken: z.string().max(200).optional(),
  twilioPhoneNumber: z.string().max(50).optional(),
  glovoWebhookSecret: z.string().max(200).optional(),
  woltWebhookSecret: z.string().max(200).optional(),
  eracuniApiToken: z.string().max(200).optional(),
  eracuniApiUrl: z.string().max(500).optional(),
})
