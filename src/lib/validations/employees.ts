// ============================================
// ZAPOSLENI (Employees) — Zaposleni, izmene, časovni vnosi
// ============================================

import { z } from 'zod'
import { cuid } from './shared'
import { PIN_MIN_LENGTH } from '@/lib/auth-middleware/constants'

// ============================================
// ZAPOSLENI (Employees)
// ============================================

export const createEmployeeSchema = z.object({
  name: z.string().min(2, 'Ime mora imeti vsaj 2 znaka').max(100),
  email: z.string().email('Neveljaven email naslov'),
  phone: z.string().max(30).default(''),
  role: z.enum(['admin', 'manager', 'staff', 'kitchen']).default('staff'),
  status: z.enum(['active', 'inactive', 'terminated']).default('active'),
  // P1-12: novi PIN-i zahtevajo 6+ mest (šibki PIN-i se zavrnejo v route —
  // WEAK_PINS seznam v auth-middleware/constants). Login dopušča legacy
  // 4-mestne PIN-e (PIN_LOGIN_LEGACY_MIN).
  pin: z.string().min(PIN_MIN_LENGTH, `PIN mora imeti vsaj ${PIN_MIN_LENGTH} števk`).max(20).regex(/^\d+$/, 'PIN mora vsebovati samo številke').optional(),
  hireDate: z.string().optional(),
  jobId: z.string().optional(),
  payRate: z.number().min(0).optional(),
})

export const updateEmployeeSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  role: z.enum(['admin', 'manager', 'staff', 'kitchen']).optional(),
  status: z.enum(['active', 'inactive', 'terminated']).optional(),
  // P1-12: samo ob prisotnosti (undefined = brez spremembe PIN-a);
  // prazen string ('') = odstrani PIN (dovoljeno)
  pin: z.union([
    z.literal(''),
    z.string().min(PIN_MIN_LENGTH).max(20).regex(/^\d+$/, 'PIN mora vsebovati samo številke'),
  ]).optional(),
  hireDate: z.string().optional(),
})

// ============================================
// IZMENE (Shifts)
// ============================================

export const createShiftSchema = z.object({
  employeeId: cuid,
  jobId: z.string().nullable().optional(),
  date: z.string(),
  startTime: z.string().max(10).default('09:00'),
  endTime: z.string().max(10).default('17:00'),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'absent']).default('scheduled'),
  breakMinutes: z.number().int().min(0).default(30),
  notes: z.string().max(500).default(''),
})

export const updateShiftSchema = z.object({
  date: z.string().optional(),
  startTime: z.string().max(10).optional(),
  endTime: z.string().max(10).optional(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'absent']).optional(),
  jobId: z.string().nullable().optional(),
  breakMinutes: z.number().int().min(0).max(480).optional(),
  notes: z.string().max(500).optional(),
})

// ============================================
// ČASOVNI VNOSI (Time Entries)
// ============================================

export const createTimeEntrySchema = z.object({
  employeeId: cuid,
  jobId: z.string().nullable().optional(),
  clockIn: z.string(),
  clockOut: z.string().nullable().optional(),
  breakStart: z.string().nullable().optional(),
  breakEnd: z.string().nullable().optional(),
  breakMinutes: z.number().int().min(0).default(0),
  type: z.enum(['regular', 'overtime', 'holiday', 'sick', 'vacation']).default('regular'),
  status: z.enum(['active', 'approved', 'disputed']).default('active'),
  notes: z.string().max(500).default(''),
})

// FIX HIGH: payRate bounds
export const updateTimeEntrySchema = z.object({
  clockOut: z.string().nullable().optional(),
  payRate: z.number().min(0, 'Plačilna stopnja ne more biti negativna').max(500, 'Plačilna stopnja ne more preseči 500/h').optional(),
  notes: z.string().max(500).optional(),
})
