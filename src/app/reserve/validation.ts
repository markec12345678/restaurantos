// =====================================================================
// Validacijska shema za javno stran rezervacij (client-side + server-side)
// =====================================================================
//
// Prejšnja koda je uporabljala goli `isValid = !!(... && ...)` brez
// preverjanja formata — npr. telefon "+386 40 123 456" in "abc" bi
// oba veljala. Sedaj z Zod shemo dobimo konkretne errorje za UI.
//

import { z } from 'zod'

export const reservationFormSchema = z.object({
  customerName: z
    .string()
    .min(2, 'Ime mora imeti vsaj 2 znaka')
    .max(100, 'Ime je predolgo (max 100 znakov)')
    .regex(/^[\p{L}\s'-]+$/u, 'Ime lahko vsebuje samo črke, presledke, vezaje in apostrofe'),
  customerPhone: z
    .string()
    .min(8, 'Telefonska številka je prekratka')
    .max(30, 'Telefonska številka je predolga')
    .regex(/^[+]?[\d\s()-]+$/, 'Telefon lahko vsebuje samo številke, +, presledke, oklepaje in vezaje'),
  customerEmail: z
    .string()
    .max(200, 'E-pošta je predolga')
    .email('Neveljaven format e-pošte')
    .optional()
    .or(z.literal('')),
  partySize: z
    .number()
    .int('Velikost skupine mora biti celo število')
    .min(1, 'Skupina mora imeti vsaj 1 osebo')
    .max(50, 'Za skupine nad 50 oseb nas kontaktirajte telefon'),
  specialRequests: z
    .string()
    .max(1000, 'Posebne želje so predolge (max 1000 znakov)')
    .default(''),
  notes: z
    .string()
    .max(1000, 'Opombe so predolge (max 1000 znakov)')
    .default(''),
})

export type ReservationFormValues = z.infer<typeof reservationFormSchema>

export function validateReservationForm(values: {
  customerName: string
  customerPhone: string
  customerEmail: string
  partySize: number
  specialRequests: string
  notes: string
}): Partial<Record<keyof ReservationFormValues, string>> {
  const result = reservationFormSchema.safeParse(values)
  if (result.success) return {}
  const errors: Partial<Record<keyof ReservationFormValues, string>> = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof ReservationFormValues
    if (!errors[field]) errors[field] = issue.message
  }
  return errors
}
