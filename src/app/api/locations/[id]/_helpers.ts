// LOKACIJA — Zod schema za posodobitev

import { z } from 'zod'

export const updateLocationSchema = z.object({
  name: z.string().min(1, 'Ime lokacije je obvezno').max(200, 'Ime ne sme preseči 200 znakov').optional(),
  code: z.string().min(1, 'Koda je obvezna').max(20, 'Koda ne sme preseči 20 znakov').regex(/^[A-Z0-9_-]+$/, 'Koda sme vsebovati samo velike črke, številke, _ in -').optional(),
  type: z.enum(['restaurant', 'food_truck', 'pop_up', 'cloud_kitchen', 'bar'], { message: 'Neveljaven tip lokacije' }).optional(),
  address: z.string().max(500, 'Naslov ne sme preseči 500 znakov').optional(),
  city: z.string().max(200, 'Mesto ne sme preseči 200 znakov').optional(),
  postCode: z.string().max(20, 'Poštna številka ne sme preseči 20 znakov').optional(),
  country: z.string().max(5, 'Koda države ne sme preseči 5 znakov').optional(),
  phone: z.string().max(50, 'Telefon ne sme preseči 50 znakov').optional(),
  email: z.string().max(200, 'Email ne sme preseči 200 znakov').optional(),
  businessId: z.string().max(50, 'Matična številka ne sme preseči 50 znakov').optional(),
  taxId: z.string().max(50, 'Davčna številka ne sme preseči 50 znakov').optional(),
  registerNumber: z.string().max(50, 'Številka registra ne sme preseči 50 znakov').optional(),
  premisesId: z.string().max(50, 'ID poslovnega prostora ne sme preseči 50 znakov').optional(),
  fursCertPath: z.string().max(500, 'Pot do certifikata ne sme preseči 500 znakov').optional(),
  fursCertPassword: z.string().max(200, 'Geslo certifikata ne sme preseči 200 znakov').optional(),
  fursEnvironment: z.enum(['test', 'production'], { message: 'Okolje mora biti test ali production' }).optional(),
  timezone: z.string().max(100, 'Časovni pas ne sme preseči 100 znakov').optional(),
  currency: z.string().max(5, 'Valuta ne sme preseči 5 znakov').optional(),
  locale: z.string().max(10, 'Locale ne sme preseči 10 znakov').optional(),
  latitude: z.number().min(-90, 'Zemljepisna širina mora biti med -90 in 90').max(90, 'Zemljepisna širina mora biti med -90 in 90').optional().nullable(),
  longitude: z.number().min(-180, 'Zemljepisna dolžina mora biti med -180 in 180').max(180, 'Zemljepisna dolžina mora biti med -180 in 180').optional().nullable(),
  isOpen: z.boolean().optional(),
  isActive: z.boolean().optional(),
})
