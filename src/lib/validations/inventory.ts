// ============================================
// INVENTURA — Zaloga, dostava, pametno naročanje
// ============================================

import { z } from 'zod'
import { cuid } from './shared'

// ============================================
// INVENTURA
// ============================================

export const createInventorySchema = z.object({
  name: z.string().min(1, 'Ime je obvezno').max(200),
  description: z.string().max(1000).default(''),
  unit: z.string().max(30).default('pcs'),
  quantity: z.number().min(0).default(0),
  minQuantity: z.number().min(0).default(10),
  costPerUnit: z.number().min(0).default(0),
  supplier: z.string().max(200).default(''),
  category: z.string().max(100).default('general'),
  location: z.string().max(100).default('main'), // FIX MEDIUM: Dodana validacija za lokacijo
  servingsPerUnit: z.number().min(0).default(1),
  servingSize: z.string().max(50).default(''),
  menuItemId: z.string().nullable().optional(),
})

export const updateInventorySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  unit: z.string().max(30).optional(),
  quantity: z.number().min(0).optional(),
  minQuantity: z.number().min(0).optional(),
  costPerUnit: z.number().min(0).optional(),
  supplier: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  location: z.string().max(100).optional(), // FIX MEDIUM: Dodana validacija za lokacijo
  servingsPerUnit: z.number().min(0).optional(),
  servingSize: z.string().max(50).optional(),
  menuItemId: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
  image: z.string().optional(),
})

export const inventoryAdjustSchema = z.object({
  inventoryItemId: cuid,
  quantity: z.number().positive().optional(),
  type: z.enum(['write-off', 'adjustment', 'return']).default('write-off'),
  reason: z.string().max(500).default(''),
  note: z.string().max(500).default(''),
  employeeName: z.string().max(100).default(''),
  supplierDoc: z.string().max(100).default(''),
  newQuantity: z.number().min(0).optional(),
})

export const batchAdjustSchema = z.object({
  items: z.array(z.object({
    inventoryItemId: cuid,
    quantity: z.number().positive(),
    reason: z.string().max(500).optional(),
    note: z.string().max(500).optional(),
  })).min(1, 'Seznam artiklov ne sme biti prazen'),
  type: z.enum(['write-off', 'adjustment', 'return']).default('write-off'),
  reason: z.string().max(500).default(''),
  employeeName: z.string().max(100).default(''),
})

// ============================================
// INVENTURA — DOSTAVA (Restock)
// ============================================

export const inventoryRestockSchema = z.object({
  inventoryItemId: cuid,
  quantity: z.number().positive('Količina mora biti pozitivna'),
  reason: z.string().max(500).default('Dostava'),
  note: z.string().max(500).default(''),
  employeeName: z.string().max(100).default(''),
  supplierDoc: z.string().max(100).default(''),
})

// ============================================
// REORDER (Smart Reorder)
// ============================================

export const createReorderSchema = z.object({
  items: z.array(z.object({
    inventoryItemId: z.string().min(1, 'ID artikla je obvezen'),
    quantity: z.number().positive('Količina mora biti pozitivna'),
    costPerUnit: z.number().min(0, 'Cena na enoto mora biti nenegativna'),
  })).min(1, 'Seznam artiklov ne sme biti prazen'),
  employeeName: z.string().max(100).default(''),
})
