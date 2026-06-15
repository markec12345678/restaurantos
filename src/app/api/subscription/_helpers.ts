// Pomožne funkcije za Subscription API
// Paketi, validacije, cenovni izračuni, računi

import { z } from 'zod'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { getNextCounter } from '@/lib/counters'
import { round2, multiply, add } from '@/lib/decimal'

// ─── Paketi ───────────────────────────────────────────────────

export const PLANS = {
  starter: {
    name: 'Starter',
    price: 29,
    features: ['1 lokacija', 'FURS potrjevanje', 'QR meni', 'Poročila', 'Zaloga', 'HACCP dnevniki', 'E-poštna podpora'],
    maxLocations: 1,
    maxMenuItems: 200,
  },
  professional: {
    name: 'Professional',
    price: 49,
    features: ['Vse iz Starter', '3 lokacije', 'Online naročanje', 'Integracije (e-Računi, Wolt, Glovo)', 'AI napovedi', 'Multi-izmena', 'Priority podpora'],
    maxLocations: 3,
    maxMenuItems: 1000,
  },
  enterprise: {
    name: 'Enterprise',
    price: 99,
    features: ['Vse iz Professional', 'Neomejene lokacije', 'API dostop', 'Stripe plačila', 'Custom integracije', 'Dedicated podpora', 'SLA 99.9%'],
    maxLocations: -1,
    maxMenuItems: -1,
  },
} as const

export type PlanKey = keyof typeof PLANS

// ─── Validacijske sheme ───────────────────────────────────────

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

// ─── Cenovni izračuni ─────────────────────────────────────────

export function calculateMonthlyPrice(planKey: PlanKey, locationCount: number): number {
  const plan = PLANS[planKey]
  if (!plan) return 0
  const basePrice = plan.price
  // FIX HIGH: Enterprise plan ima maxLocations: -1 (neomejeno)
  const extraLocations = plan.maxLocations < 0
    ? 0 // Neomejene lokacije — brez doplačila
    : Math.max(0, locationCount - plan.maxLocations)
  return basePrice + (extraLocations * 15) // 15€ na dodatno lokacijo
}

export function calculateInvoiceAmounts(monthlyPrice: number): {
  amount: number
  vatRate: number
  vatAmount: number
  totalAmount: number
  dueDate: Date
} {
  const now = new Date()
  const vatRate = 22
  const vatAmount = round2(multiply(monthlyPrice, vatRate / 100))
  const totalAmount = round2(add(monthlyPrice, vatAmount))
  const dueDate = new Date(now)
  dueDate.setDate(dueDate.getDate() + 15)
  return { amount: monthlyPrice, vatRate, vatAmount, totalAmount, dueDate }
}

// ─── Računi ──────────────────────────────────────────────────

export async function createTrialInvoice(
  subscriptionId: string,
  now: Date,
  trialEnd: Date
): Promise<void> {
  try {
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const seq = await getNextCounter('invoiceNumber')
    const invoiceNumber = `NAR-${year}${month}-${String(seq).padStart(4, '0')}`

    await db.subscriptionInvoice.create({
      data: {
        subscriptionId,
        invoiceNumber,
        amount: 0, // Trial brezplačen
        vatRate: 22,
        vatAmount: 0,
        totalAmount: 0,
        currency: 'EUR',
        periodStart: now,
        periodEnd: trialEnd,
        dueDate: trialEnd,
        status: 'paid',
        paidAt: now,
      },
    })
  } catch (e: unknown) {
    logger.error('API', 'Auto-invoice creation error:', e)
  }
}

export async function createActivationInvoice(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  subscriptionId: string,
  monthlyPrice: number,
  currency: string
): Promise<void> {
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + 1)
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  // FIX CRITICAL: Uporabi atomski counter namesto count + 1 (race condition)
  const seq = await getNextCounter('invoiceNumber')
  const invoiceNumber = `NAR-${year}${month}-${String(seq).padStart(4, '0')}`

  const { amount, vatRate, vatAmount, totalAmount, dueDate } = calculateInvoiceAmounts(monthlyPrice)

  await tx.subscriptionInvoice.create({
    data: {
      subscriptionId,
      invoiceNumber,
      amount,
      vatRate,
      vatAmount,
      totalAmount,
      currency: currency || 'EUR',
      periodStart: now,
      periodEnd,
      dueDate,
      status: 'pending',
    },
  })
}

// ─── Posodobitve naročnine ──────────────────────────────────

export interface SubscriptionUpdateData {
  plan?: string
  status?: string
  locationCount?: number
  paymentMethod?: string
}

export function buildSubscriptionUpdateData(data: SubscriptionUpdateData & { id: string }): Record<string, unknown> {
  const updateData: Record<string, unknown> = {}

  if (data.plan) {
    const plan = PLANS[data.plan as PlanKey]
    updateData.plan = data.plan
    if (data.locationCount) {
      updateData.monthlyPrice = calculateMonthlyPrice(data.plan as PlanKey, data.locationCount)
      updateData.locationCount = data.locationCount
    } else {
      updateData.monthlyPrice = plan.price
    }
  }
  if (data.status) updateData.status = data.status
  if (data.locationCount && !data.plan) updateData.locationCount = data.locationCount
  if (data.paymentMethod) updateData.paymentMethod = data.paymentMethod

  if (data.status === 'active' && !data.plan) {
    const now = new Date()
    updateData.currentPeriodStart = now
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1)
    updateData.currentPeriodEnd = periodEnd
  }

  if (data.status === 'cancelled') {
    updateData.cancelledAt = new Date()
  }

  return updateData
}
