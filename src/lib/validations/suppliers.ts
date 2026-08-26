// ============================================
// DOBAVITELJI — Dobavitelji, nabavna naročila, dostava
// ============================================

import { z } from 'zod'

// ============================================
// NABAVNA NAROČILA (Purchase Orders)
// ============================================

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'Dobavitelj je obvezen'),
  items: z.array(z.object({
    description: z.string().min(1).max(200),
    inventoryItemId: z.string().nullable().optional(),
    quantityOrdered: z.number().positive('Količina mora biti pozitivna'),
    unit: z.string().max(30).default('kos'),
    unitPrice: z.number().min(0).default(0),
    vatRate: z.number().min(0).max(100).default(22.0),
    notes: z.string().max(500).default(''),
  })).min(1, 'Naročilo mora vsebovati vsaj eno postavko'),
  expectedDate: z.string().nullable().optional(),
  deliveryAddress: z.string().max(200).default(''),
  deliveryNotes: z.string().max(500).default(''),
  notes: z.string().max(1000).default(''),
})

// ============================================
// DOBAVITELJI (Suppliers)
// ============================================

export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Ime dobavitelja je obvezno').max(200),
  code: z.string().max(50).default(''),
  contactPerson: z.string().max(100).default(''),
  email: z.string().email().optional().or(z.literal('')).default(''),
  phone: z.string().max(30).default(''),
  address: z.string().max(200).default(''),
  city: z.string().max(100).default(''),
  postCode: z.string().max(20).default(''),
  country: z.string().max(100).default('Slovenija'),
  businessId: z.string().max(50).default(''),
  taxId: z.string().max(50).default(''),
  iban: z.string().max(34).default(''),
  bank: z.string().max(100).default(''),
  paymentTerms: z.string().max(100).default('30 dni'),
  deliveryDays: z.string().max(200).default('[]'),
  minOrderAmount: z.number().min(0).default(0),
  rating: z.number().min(0).max(5).default(0),
  isActive: z.boolean().default(true),
})

export const updateSupplierSchema = z.object({
  name: z.string().max(200).optional(),
  code: z.string().max(50).optional(),
  contactPerson: z.string().max(100).optional(),
  email: z.string().email().optional().or(z.literal('')).optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  postCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  businessId: z.string().max(50).optional(),
  taxId: z.string().max(50).optional(),
  iban: z.string().max(34).optional(),
  bank: z.string().max(100).optional(),
  paymentTerms: z.string().max(100).optional(),
  deliveryDays: z.string().max(200).optional(),
  minOrderAmount: z.number().min(0).optional(),
  rating: z.number().min(0).max(5).optional(),
  isActive: z.boolean().optional(),
})

// ============================================
// DOBAVA (Delivery)
// ============================================

export const createDeliverySchema = z.object({
  address: z.string().min(1, 'Naslov je obvezen').max(300),
  city: z.string().max(100).default(''),
  postCode: z.string().max(20).default(''),
  recipientName: z.string().max(100).default(''),
  recipientPhone: z.string().max(30).default(''),
  deliveryInstructions: z.string().max(500).default(''),
  promisedTime: z.string().nullable().optional(),
  estimatedTime: z.string().nullable().optional(),
  courierName: z.string().max(100).default(''),
  courierPhone: z.string().max(30).default(''),
  status: z.enum(['pending', 'preparing', 'ready', 'picked_up', 'delivered', 'failed']).default('pending'),
  packagingFee: z.number().min(0).default(0),
  deliveryFee: z.number().min(0).default(0),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
})

export const updateDeliverySchema = z.object({
  address: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
  postCode: z.string().max(20).optional(),
  recipientName: z.string().max(100).optional(),
  recipientPhone: z.string().max(30).optional(),
  deliveryInstructions: z.string().max(500).optional(),
  promisedTime: z.string().nullable().optional(),
  estimatedTime: z.string().nullable().optional(),
  actualTime: z.string().nullable().optional(),
  courierName: z.string().max(100).optional(),
  courierPhone: z.string().max(30).optional(),
  status: z.enum(['pending', 'preparing', 'ready', 'picked_up', 'delivered', 'failed']).optional(),
  packagingFee: z.number().min(0).optional(),
  deliveryFee: z.number().min(0).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
})
