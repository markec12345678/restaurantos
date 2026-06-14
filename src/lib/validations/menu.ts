// ============================================
// MENU — Artikli, kategorije, meniji, modifikatorji, pakiranje, happy hour
// ============================================

import { z } from 'zod'
import { cuid } from './shared'

// ============================================
// MENU ARTIKLI
// ============================================

export const createMenuItemSchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(200),
  description: z.string().max(1000).default(''),
  price: z.number().min(0.01, 'Cena mora biti pozitivna'),
  image: z.string().default(''),
  isAvailable: z.boolean().default(true),
  vatRate: z.number().min(0).max(100).default(22.0),
  // FIX HIGH: Validacija EU alergen kod — prejšnja regex je dovoljevala katerikoli 1-2 številki (npr. 15, 99, 0)
  // EU kode: 1-14 (Regulation 1169/2011 Annex II) — invalid kode so varnostno tveganje (alergiji)
  allergens: z.string().refine(val => {
    if (!val) return true
    return val.split(',').every(code => {
      const n = parseInt(code.trim(), 10)
      return n >= 1 && n <= 14
    })
  }, 'Alergeni morajo biti vejiko ločene EU kode 1-14').default(''),
  categoryId: cuid,
  salesCategoryId: z.string().nullable().optional(),
  priceGroupId: z.string().nullable().optional(),
  revenueCenterId: z.string().nullable().optional(),
  prepStationId: z.string().nullable().optional(),
})

export const updateMenuItemSchema = createMenuItemSchema.partial().extend({
  sortOrder: z.number().int().min(0).optional(),
  modifierGroupIds: z.array(z.string().min(1)).optional(),
})

// ============================================
// KATEGORIJE (Categories) — Premaknjeno iz /api/categories/route.ts
// Centralizirana shema za konsistentno validacijo in testiranje
// ============================================

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(100),
  icon: z.string().max(10).default('🍽️'),
  color: z.string().max(20).default('#f59e0b'),
  sortOrder: z.number().int().min(0).default(0),
  menuId: z.string().min(1, 'menuId je obvezen'),
})

// ============================================
// MENIJI (Menus) — FIX HIGH: Input validation
// ============================================

export const createMenuSchema = z.object({
  name: z.string().min(1, 'Ime menija je obvezno').max(100, 'Ime ne sme preseči 100 znakov'),
  icon: z.string().max(10, 'Ikona ne sme preseči 10 znakov').default('📋'),
  color: z.string().max(7, 'Barva mora biti hex format (#RRGGBB)').default('#f59e0b')
    .refine(val => /^#[0-9a-fA-F]{6}$/.test(val), 'Barva mora biti veljaven hex format'),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
})

export const updateMenuSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().max(10).optional(),
  color: z.string().max(7).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
})

// ============================================
// MODIFIKATORJI (Modifier Groups) — FIX CRITICAL: Input validation
// ============================================

const modifierSchema = z.object({
  name: z.string().min(1, 'Ime modifikatorja je obvezno').max(100, 'Ime ne sme preseči 100 znakov'),
  price: z.number().min(0, 'Cena ne more biti negativna').max(10000, 'Cena ne more preseči 10.000'),
  sortOrder: z.number().int().min(0).max(9999).default(0),
})

export const createModifierGroupSchema = z.object({
  name: z.string().min(1, 'Ime skupine je obvezno').max(100, 'Ime ne sme preseči 100 znakov'),
  required: z.boolean().default(false),
  minSelect: z.number().int().min(0).max(50).default(0),
  maxSelect: z.number().int().min(0).max(50).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  modifiers: z.array(modifierSchema).max(100, 'Največ 100 modifikatorjev').optional(),
  // FIX CRITICAL: Prepreči injection polj — menuItems povezave
  menuItemIds: z.array(z.string().min(1)).max(200).optional(),
})

export const updateModifierGroupSchema = z.object({
  name: z.string().min(1, 'Ime skupine je obvezno').max(100, 'Ime ne sme preseči 100 znakov').optional(),
  required: z.boolean().optional(),
  minSelect: z.number().int().min(0).max(50).optional(),
  maxSelect: z.number().int().min(0).max(50).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  modifiers: z.array(modifierSchema).max(100, 'Največ 100 modifikatorjev').optional(),
  menuItemIds: z.array(z.string().min(1)).max(200).optional(),
})

// ============================================
// PAKIRANJE (Packaging) — FIX HIGH: Input validation
// ============================================

const packagingItemSchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(100),
  price: z.number().min(0, 'Cena ne more biti negativna').max(1000),
  quantity: z.number().int().min(1, 'Količina mora biti vsaj 1').max(999),
  sortOrder: z.number().int().min(0).max(9999).default(0),
})

export const createPackagingSchema = z.object({
  name: z.string().min(1, 'Ime pakiranja je obvezno').max(100),
  description: z.string().max(500).default(''),
  items: z.array(packagingItemSchema).max(50, 'Največ 50 artiklov').default([]),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
})

export const updatePackagingSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  items: z.array(packagingItemSchema).max(50).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
})

// ============================================
// HAPPY HOUR SCHEDULE
// ============================================

export const createHappyHourSchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(200),
  description: z.string().max(1000).default(''),
  priceGroupId: z.string().min(1, 'Cenik je obvezen'),
  discountType: z.enum(['none', 'percentage', 'fixed_amount']).default('none'),
  discountAmount: z.number().min(0).default(0),
  daysOfWeek: z.array(z.number().int().min(1).max(7)).min(1, 'Vsaj en dan je obvezen').default([1, 2, 3, 4, 5]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM je obvezen'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM je obvezen'),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
  appliesTo: z.enum(['all', 'category', 'item']).default('all'),
  appliesToIds: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  autoActivate: z.boolean().default(true),
})
