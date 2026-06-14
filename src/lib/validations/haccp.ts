// ============================================
// HACCP — Higienska kontrola, ustvarjanje in posodabljanje
// ============================================

import { z } from 'zod'

export const createHaccpSchema = z.object({
  date: z.string().optional(),
  category: z.enum(['temperature', 'cleaning', 'delivery', 'cooling', 'training']),
  title: z.string().min(1, 'Naslov je obvezen').max(200),
  description: z.string().max(1000).default(''),
  value: z.string().max(200).default(''),
  status: z.enum(['ok', 'warning', 'critical']).default('ok'),
  correctiveAction: z.string().max(1000).default(''),
  employeeName: z.string().max(100).default(''),
})

// HACCP POSODOBITEV — Premaknjeno iz /api/haccp/route.ts
// Centralizirana shema za konsistentno validacijo in testiranje
export const haccpUpdateSchema = z.object({
  id: z.string().min(1, 'ID je obvezen'),
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  value: z.string().max(200).optional(),
  status: z.enum(['ok', 'warning', 'critical']).optional(),
  correctiveAction: z.string().max(1000).optional(),
  employeeName: z.string().max(100).optional(),
})
