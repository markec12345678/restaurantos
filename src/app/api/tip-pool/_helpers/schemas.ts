// Sheme in tipi za Tip Pool API

import { z } from 'zod'

// ─── Validacijske sheme ───────────────────────────────────────

export const createTipPoolSchema = z.object({
  date: z.string().min(1, 'Datum je obvezen').max(30, 'Neveljaven format datuma'),
  distributionMethod: z.enum(['equal', 'hours', 'points', 'manual']).default('equal'),
  locationId: z.string().max(100, 'ID lokacije je predolg').optional(),
})

export const distributeTipsSchema = z.object({
  tipPoolId: z.string().min(1, 'ID tip poola je obvezen').max(100, 'ID je predolg'),
  distributions: z.array(z.object({
    employeeId: z.string().min(1, 'ID zaposlenega je obvezen').max(100, 'ID je predolg'),
    employeeName: z.string().min(1, 'Ime zaposlenega je obvezno').max(100, 'Ime je predolgo'),
    hoursWorked: z.number().min(0).max(24, 'Ure ne morejo preseči 24').default(0),
    points: z.number().min(0).max(1000, 'Preveč točk').default(0),
    amount: z.number().min(0, 'Znesek ne more biti negativen').max(999999, 'Znesek je previsok'),
  })).min(1, 'Vsaj ena distribucija je obvezna').max(100, 'Preveč distribucij'),
})

// ─── Tipi za distribucijo ─────────────────────────────────────

export interface EmployeeEntry {
  employeeId: string
  employeeName: string
  hoursWorked: number
  points: number
}

export interface Distribution extends EmployeeEntry {
  amount: number
}
