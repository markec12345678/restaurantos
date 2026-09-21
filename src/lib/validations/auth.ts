// ============================================
// AVTENTIKACIJA — Prijava, odzivi
// ============================================

import { z } from 'zod'
import { PIN_LOGIN_LEGACY_MIN } from '@/lib/auth-middleware/constants'

// ============================================
// AUTH
// ============================================

// P1-12: LOGIN dopušča legacy 4-mestne PIN-e (migracijska kompatibilnost —
// obstoječi zaposleni se lahko prijavijo; admin jih rotira prek employees
// POST/PUT, kjer v veljavnosti novih PIN-i zahtevajo 6+ mest).
// R95 kontrakt (dvostopenjska prijava — BINDING-WHEN-PRESENT):
//   - employeeId PODAN = strog binding — PIN se preverja TOČNO proti temu
//     zaposlenemu (verifyPin binding veja; manjkajoč/neaktiven/napačen PIN
//     → ISTI enoten 401, zero oracle);
//   - employeeId ODSOTEN = legacy deterministični lastnik PIN-a (R94 kontrakt,
//     e2e EDGE-4/15 pini ostanejo zeleni).
export const loginSchema = z.object({
  pin: z.string().min(PIN_LOGIN_LEGACY_MIN, `PIN mora imeti vsaj ${PIN_LOGIN_LEGACY_MIN} števke`).max(20).regex(/^\d+$/, 'PIN mora vsebovati samo številke'),
  // R95-a: opcionalen cilj bindinga — id zaposlenega iz GET /api/auth/employees
  // (cuid/uuid razred: črke, številke, podčrtaj, pomišljaj; min 5 = usklajeno
  // z LOCATION_ID_RE kanonom v src/lib/ordering-token.ts).
  employeeId: z.string().min(5).max(100).regex(/^[A-Za-z0-9_-]+$/, 'Neveljaven ID zaposlenega').optional(),
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
