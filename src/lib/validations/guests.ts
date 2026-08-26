// ============================================
// GOSTI — Gostje, povratne informacije, rezervacije, čakalna vrsta
// ============================================

import { z } from 'zod'

// ============================================
// GOSTI (Guests / CRM)
// ============================================

export const createGuestSchema = z.object({
  firstName: z.string().max(100).default(''),
  lastName: z.string().min(1, 'Priimek je obvezen').max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).default(''),
  isVip: z.boolean().default(false),
  allergens: z.array(z.string()).default([]),
  dietaryPrefs: z.array(z.string()).default([]),
  dislikes: z.array(z.string()).default([]),
  favoriteItems: z.array(z.string()).default([]),
  birthday: z.string().nullable().optional(),
  anniversary: z.string().nullable().optional(),
  company: z.string().max(200).default(''),
  notes: z.string().max(1000).default(''),
})

export const updateGuestSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  email: z.string().email().optional().or(z.literal('')).optional(),
  phone: z.string().max(30).optional(),
  isVip: z.boolean().optional(),
  allergens: z.array(z.string()).optional(),
  dietaryPrefs: z.array(z.string()).optional(),
  dislikes: z.array(z.string()).optional(),
  favoriteItems: z.array(z.string()).optional(),
  birthday: z.string().nullable().optional(),
  anniversary: z.string().nullable().optional(),
  company: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
})

// ============================================
// POVZETNA INFORMACIJA GOSTOV (Guest Feedback) — FIX MEDIUM: Zod validacija
// ============================================

export const createGuestFeedbackSchema = z.object({
  guestId: z.string().max(100).optional(),
  guestName: z.string().max(200).default(''),
  orderId: z.string().max(100).optional(),
  overallRating: z.number().int().min(1, 'Skupna ocena mora biti vsaj 1').max(5, 'Skupna ocena ne more preseči 5'),
  foodRating: z.number().int().min(0).max(5).default(0),
  serviceRating: z.number().int().min(0).max(5).default(0),
  atmosphereRating: z.number().int().min(0).max(5).default(0),
  comment: z.string().max(1000, 'Komentar ne sme preseči 1000 znakov').default(''),
  tags: z.array(z.string().max(50)).max(20, 'Največ 20 oznak').default([]),
  wouldReturn: z.boolean().default(true),
  wouldRecommend: z.boolean().default(true),
  source: z.enum(['pos', 'web', 'qr_kiosk', 'receipt']).default('pos'),
})

// ============================================
// REZERVACIJE (Reservations)
// ============================================

export const createReservationSchema = z.object({
  customerName: z.string().min(1, 'Ime stranke je obvezno').max(100),
  customerPhone: z.string().max(30).default(''),
  customerEmail: z.string().email().optional().or(z.literal('')).default(''),
  tableId: z.string().nullable().optional(),
  dateTime: z.string().min(1, 'Datum/čas je obvezen'),
  partySize: z.number().int().min(1, 'Število oseb mora biti vsaj 1').max(100),
  duration: z.number().int().min(15).max(600).default(120),
  notes: z.string().max(1000).default(''),
  specialRequests: z.string().max(500).default(''),
  source: z.enum(['walk_in', 'phone', 'website', 'app']).default('walk_in'),
})

export const updateReservationSchema = z.object({
  customerName: z.string().max(100).optional(),
  customerPhone: z.string().max(30).optional(),
  customerEmail: z.string().email().optional().or(z.literal('')).optional(),
  tableId: z.string().nullable().optional(),
  dateTime: z.string().optional(),
  partySize: z.number().int().min(1).max(100).optional(),
  duration: z.number().int().min(15).max(600).optional(),
  notes: z.string().max(1000).optional(),
  specialRequests: z.string().max(500).optional(),
  status: z.enum(['confirmed', 'seated', 'completed', 'cancelled', 'no_show']).optional(),
})

// ============================================
// ČAKALNA VRSTA (Waitlist)
// ============================================

export const createWaitlistSchema = z.object({
  guestName: z.string().min(1, 'Ime gosta je obvezno').max(100),
  guestPhone: z.string().max(30).default(''),
  partySize: z.number().int().min(1, 'Število oseb mora biti vsaj 1').max(50),
  quotedWaitMinutes: z.number().int().min(0).default(0),
  preferredArea: z.string().max(50).default(''),
  specialNeeds: z.string().max(500).default(''),
  notes: z.string().max(500).default(''),
})
