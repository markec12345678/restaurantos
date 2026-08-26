// Sheme za validacijo in konstante za javna QR naročila

import { z } from 'zod'

export const publicOrderItemSchema = z.object({
  menuItemId: z.string().min(1, 'ID artikla je obvezen').max(100, 'ID artikla ne sme preseči 100 znakov'),
  quantity: z.number().int().min(1, 'Količina mora biti vsaj 1').max(20, 'Maksimalno 20 enot na artikel'),
  notes: z.string().max(500, 'Opombe ne smejo preseči 500 znakov').default(''),
  modifiersJson: z.string().max(2000, 'Modifikatorji ne smejo preseči 2000 znakov').default('[]'),
})

export const publicOrderSchema = z.object({
  tableId: z.string().max(100, 'ID mize ne sme preseči 100 znakov').optional(),
  tableNumber: z.union([z.string().max(10, 'Številka mize ne sme preseči 10 znakov'), z.number().int().min(1, 'Številka mize mora biti vsaj 1').max(999, 'Številka mize ne sme preseči 999')]).optional(),
  customerName: z.string().max(100, 'Ime stranke ne sme preseči 100 znakov').default(''),
  customerPhone: z.string().max(30, 'Telefon ne sme preseči 30 znakov').default(''),
  notes: z.string().max(1000, 'Opombe ne smejo preseči 1000 znakov').default(''),
  items: z.array(publicOrderItemSchema).min(1, 'Naročilo mora vsebovati vsaj en artikel').max(30, 'Maksimalno 30 artiklov na naročilo').optional(),
  orderItems: z.array(publicOrderItemSchema).min(1, 'Naročilo mora vsebovati vsaj en artikel').max(30, 'Maksimalno 30 artiklov na naročilo').optional(),
}).refine(data => data.items?.length || data.orderItems?.length, {
  message: 'Naročilo mora vsebovati vsaj en artikel',
})

export const MAX_ORDER_TOTAL = 2000 // €2000 max za QR naročilo
