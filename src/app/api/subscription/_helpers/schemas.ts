// Validacijske sheme za Subscription API

import { z } from 'zod'

export const createSubscriptionSchema = z.object({
  companyName: z.string().min(1, 'Ime podjetja je obvezno').max(200, 'Ime podjetja ne sme preseči 200 znakov'),
  email: z.string().email('Veljaven email je obvezen').max(200, 'Email ne sme preseči 200 znakov'),
  phone: z.string().max(50, 'Telefon ne sme preseči 50 znakov').default(''),
  taxId: z.string().max(50, 'Davčna številka ne sme preseči 50 znakov').default(''),
  businessId: z.string().max(50, 'Matična številka ne sme preseči 50 znakov').default(''),
  plan: z.enum(['starter', 'professional', 'enterprise'], { message: 'Paket mora biti starter, professional ali enterprise' }),
  paymentMethod: z.enum(['card', 'bank_transfer', 'invoice'], { message: 'Način plačila mora biti card, bank_transfer ali invoice' }).default('bank_transfer'),
  locationCount: z.number().int().min(1, 'Število lokacij mora biti vsaj 1').max(100, 'Število lokacij ne sme preseči 100').default(1),
})

export const updateSubscriptionSchema = z.object({
  id: z.string().min(1, 'ID naročnine je obvezen').max(100, 'ID ne sme preseči 100 znakov'),
  plan: z.enum(['starter', 'professional', 'enterprise'], { message: 'Paket mora biti starter, professional ali enterprise' }).optional(),
  status: z.enum(['trial', 'active', 'past_due', 'cancelled', 'expired'], { message: 'Neveljaven status naročnine' }).optional(),
  locationCount: z.number().int().min(1, 'Število lokacij mora biti vsaj 1').max(100, 'Število lokacij ne sme preseči 100').optional(),
  paymentMethod: z.enum(['card', 'bank_transfer', 'invoice'], { message: 'Način plačila mora biti card, bank_transfer ali invoice' }).optional(),
})
