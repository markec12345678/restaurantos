// =====================================================================
// Validacijska shema za /order (online naročanje) — client-side
// =====================================================================
//
// Enak vzorec kot v /reserve/validation.ts — Zod shema vrača konkretne
// errorje, ki jih UI prikaže pod polji.
//

import { z } from 'zod'
import type { DeliveryDetails, TakeoutDetails } from './types'

// Skupna polja
const fullNameField = z
  .string()
  .min(2, 'Ime mora imeti vsaj 2 znaka')
  .max(100, 'Ime je predolgo (max 100 znakov)')
  .regex(/^[\p{L}\s'-]+$/u, 'Ime lahko vsebuje samo črke, presledke, vezaje in apostrofe')

const phoneField = z
  .string()
  .min(8, 'Telefonska številka je prekratka')
  .max(30, 'Telefonska številka je predolga')
  .regex(/^[+]?[\d\s()-]+$/, 'Telefon lahko vsebuje samo številke, +, presledke, oklepaje in vezaje')

const emailField = z
  .string()
  .max(200, 'E-pošta je predolga')
  .email('Neveljaven format e-pošte')
  .optional()
  .or(z.literal(''))

const notesField = z
  .string()
  .max(1000, 'Opombe so predolge (max 1000 znakov)')
  .default('')

export const deliveryDetailsSchema = z.object({
  fullName: fullNameField,
  phone: phoneField,
  email: emailField,
  address: z
    .string()
    .min(5, 'Naslov je prekratek (min 5 znakov)')
    .max(200, 'Naslov je predolgo (max 200 znakov)'),
  city: z
    .string()
    .min(2, 'Mesto je obvezno')
    .max(100, 'Mesto je predolgo (max 100 znakov)'),
  postCode: z
    .string()
    .min(4, 'Poštna številka je obvezna')
    .max(10, 'Poštna številka je predolga')
    .regex(/^[\d-]+$/, 'Poštna številka lahko vsebuje samo številke in vezaje'),
  notes: notesField,
})

export const takeoutDetailsSchema = z.object({
  fullName: fullNameField,
  phone: phoneField,
  email: emailField,
  notes: notesField,
  preferredTime: z
    .string()
    .max(10, 'Čas je predolgi')
    .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'Neveljaven format časa (HH:MM)')
    .optional()
    .or(z.literal('')),
})

export type DeliveryDetailsErrors = Partial<Record<keyof DeliveryDetails, string>>
export type TakeoutDetailsErrors = Partial<Record<keyof TakeoutDetails, string>>

export function validateDeliveryDetails(values: DeliveryDetails): DeliveryDetailsErrors {
  const result = deliveryDetailsSchema.safeParse(values)
  if (result.success) return {}
  const errors: DeliveryDetailsErrors = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof DeliveryDetails
    if (!errors[field]) errors[field] = issue.message
  }
  return errors
}

export function validateTakeoutDetails(values: TakeoutDetails): TakeoutDetailsErrors {
  const result = takeoutDetailsSchema.safeParse(values)
  if (result.success) return {}
  const errors: TakeoutDetailsErrors = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof TakeoutDetails
    if (!errors[field]) errors[field] = issue.message
  }
  return errors
}
