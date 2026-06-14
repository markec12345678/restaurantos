// ============================================
// MIZE (Tables) — Ustvarjanje in posodabljanje
// ============================================

import { z } from 'zod'

export const createTableSchema = z.object({
  number: z.number().int().min(1, 'Številka mize mora biti vsaj 1').max(999),
  capacity: z.number().int().min(1, 'Kapaciteta mora biti vsaj 1').max(50).default(4),
  status: z.enum(['available', 'occupied', 'reserved', 'cleaning']).default('available'),
  area: z.string().max(50).default('main'),
  // FIX HIGH: Vizualni tloris — validiraj z Zod namesto direktnega branja iz body-ja
  posX: z.number().min(0).max(100).optional(),
  posY: z.number().min(0).max(100).optional(),
  width: z.number().min(1).max(50).optional(),
  height: z.number().min(1).max(50).optional(),
  shape: z.enum(['round', 'square', 'rectangular', 'booth']).optional(),
  rotation: z.number().min(0).max(360).optional(),
})

export const updateTableSchema = z.object({
  number: z.number().int().min(1).max(999).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  status: z.enum(['available', 'occupied', 'reserved', 'cleaning']).optional(),
  area: z.string().max(50).optional(),
  // FIX HIGH: Vizualni tloris — validiraj z Zod
  posX: z.number().min(0).max(100).optional(),
  posY: z.number().min(0).max(100).optional(),
  width: z.number().min(1).max(50).optional(),
  height: z.number().min(1).max(50).optional(),
  shape: z.enum(['round', 'square', 'rectangular', 'booth']).optional(),
  rotation: z.number().min(0).max(360).optional(),
})
