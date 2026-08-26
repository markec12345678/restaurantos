// ============================================
// AVTENTIKACIJA — Prijava, odzivi
// ============================================

import { z } from 'zod'

// ============================================
// AUTH
// ============================================

export const loginSchema = z.object({
  pin: z.string().min(4, 'PIN mora imeti vsaj 4 števke').max(20).regex(/^\d+$/, 'PIN mora vsebovati samo številke'),
})

// ============================================
// ODZIVNE SHEME — Avtentikacija
// ============================================

// ─── Avtentikacijski odziv (POST /api/auth) ───
export const authResponseSchema = z.object({
  success: z.boolean(),
  employee: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.string(),
    primaryJob: z.object({
      id: z.string(),
      name: z.string(),
      payRate: z.number().nullable(),
    }).nullable(),
    permissions: z.array(z.string()),
  }).optional(),
  token: z.string().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
})

// ─── Status avtentikacije (GET /api/auth) ───
export const authStatusResponseSchema = z.object({
  authenticated: z.boolean(),
  authEnabled: z.boolean(),
  employeesWithPin: z.number(),
  availableRoles: z.array(z.string()).optional(),
  session: z.object({
    employeeId: z.string(),
    role: z.string(),
    permissions: z.array(z.string()),
  }).nullable(),
})
