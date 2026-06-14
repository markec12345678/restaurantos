
// =====================================================================
// SUBSCRIPTION API — SaaS naročnina
// Paketi: Starter (29€), Professional (49€), Enterprise (99€)
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getNextCounter } from '@/lib/counters'
import { toNum, round2, multiply, add, deepToNumbers } from '@/lib/decimal'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { handleApiError, validateRequest } from '@/lib/api-utils'
const PLANS = {
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

type PlanKey = keyof typeof PLANS

// GET /api/subscription — Trenutna naročnina + paketi
export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    // Pridobi trenutno naročnino
    const subscription = await db.subscription.findFirst({
      where: { status: { in: ['trial', 'active', 'past_due'] } },
      include: {
        invoices: {
          where: { status: { in: ['pending', 'paid'] } },
          orderBy: { createdAt: 'desc' },
          take: 12,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Statistika
    const totalInvoices = await db.subscriptionInvoice.count()
    const paidInvoices = await db.subscriptionInvoice.count({ where: { status: 'paid' } })
    const totalRevenue = await db.subscriptionInvoice.aggregate({
      where: { status: 'paid' },
      _sum: { totalAmount: true },
    })

    return NextResponse.json({
      subscription,
      plans: PLANS,
      stats: {
        totalInvoices,
        paidInvoices,
        totalRevenue: toNum(totalRevenue._sum.totalAmount),
      },
    })
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/subscription', 'Napaka pri pridobivanju naročnine')
  }
}

// POST /api/subscription — Ustvari/nadgradnja naročnino
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const createSubscriptionSchema = z.object({
      companyName: z.string().min(1, 'Ime podjetja je obvezno').max(200, 'Ime podjetja ne sme preseči 200 znakov'),
      email: z.string().email('Veljaven email je obvezen').max(200, 'Email ne sme preseči 200 znakov'),
      phone: z.string().max(50, 'Telefon ne sme preseči 50 znakov').default(''),
      taxId: z.string().max(50, 'Davčna številka ne sme preseči 50 znakov').default(''),
      businessId: z.string().max(50, 'Matična številka ne sme preseči 50 znakov').default(''),
      plan: z.enum(['starter', 'professional', 'enterprise'], { message: 'Paket mora biti starter, professional ali enterprise' }),
      paymentMethod: z.enum(['card', 'bank_transfer', 'invoice'], { message: 'Način plačila mora biti card, bank_transfer ali invoice' }).default('bank_transfer'),
      locationCount: z.number().int().min(1, 'Število lokacij mora biti vsaj 1').max(100, 'Število lokacij ne sme preseči 100').default(1),
    })

    const { data, error: validationError } = await validateRequest(req, createSubscriptionSchema)
    if (validationError) return validationError
    const plan = PLANS[data.plan as PlanKey]
    if (!plan) {
      return NextResponse.json({ error: 'Neveljaven paket' }, { status: 400 })
    }

    // Preveri, da ni že aktivna naročnina
    const existing = await db.subscription.findFirst({
      where: { email: data.email, status: { in: ['trial', 'active'] } },
    })
    if (existing) {
      return NextResponse.json({ error: 'Naročnina za ta email že obstaja' }, { status: 409 })
    }

    // Izračunaj ceno glede na lokacije
    const basePrice = plan.price
    // FIX HIGH: Enterprise plan ima maxLocations: -1 (neomejeno) — prej je bilo
    // Math.max(0, 1-(-1)) = 2, kar je zaračunalo 30€ za nič
    const extraLocations = plan.maxLocations < 0
      ? 0 // Neomejene lokacije — brez doplačila
      : Math.max(0, data.locationCount - plan.maxLocations)
    const monthlyPrice = basePrice + (extraLocations * 15) // 15€ na dodatno lokacijo

    const now = new Date()
    const trialEnd = new Date(now)
    trialEnd.setDate(trialEnd.getDate() + 14) // 14-dnevni trial

    const subscription = await db.subscription.create({
      data: {
        companyName: data.companyName,
        email: data.email,
        phone: data.phone,
        taxId: data.taxId,
        businessId: data.businessId,
        plan: data.plan,
        status: 'trial',
        monthlyPrice,
        locationCount: data.locationCount,
        paymentMethod: data.paymentMethod,
        trialStartsAt: now,
        trialEndsAt: trialEnd,
      },
    })

    // Samodejno generiraj prvi račun za trial obdobje (0€)
    try {
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const seq = await getNextCounter('invoiceNumber')
      const invoiceNumber = `NAR-${year}${month}-${String(seq).padStart(4, '0')}`

      await db.subscriptionInvoice.create({
        data: {
          subscriptionId: subscription.id,
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

    return NextResponse.json(deepToNumbers(subscription), { status: 201 })
  } catch (error: unknown) {
    return handleApiError(error, 'POST /api/subscription', 'Napaka pri ustvarjanju naročnine')
  }
}

// PATCH /api/subscription — Nadgradnja/sprememba paketa
export async function PATCH(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const updateSubscriptionSchema = z.object({
      id: z.string().min(1, 'ID naročnine je obvezen').max(100, 'ID ne sme preseči 100 znakov'),
      plan: z.enum(['starter', 'professional', 'enterprise'], { message: 'Paket mora biti starter, professional ali enterprise' }).optional(),
      status: z.enum(['trial', 'active', 'past_due', 'cancelled', 'expired'], { message: 'Neveljaven status naročnine' }).optional(),
      locationCount: z.number().int().min(1, 'Število lokacij mora biti vsaj 1').max(100, 'Število lokacij ne sme preseči 100').optional(),
      paymentMethod: z.enum(['card', 'bank_transfer', 'invoice'], { message: 'Način plačila mora biti card, bank_transfer ali invoice' }).optional(),
    })

    const { data, error: validationError } = await validateRequest(req, updateSubscriptionSchema)
    if (validationError) return validationError
    const updateData: Record<string, unknown> = {}

    if (data.plan) {
      const plan = PLANS[data.plan as PlanKey]
      updateData.plan = data.plan
      if (data.locationCount) {
        // FIX HIGH: Enak popravk kot pri POST — maxLocations: -1 pomeni neomejeno
        const extraLocations = plan.maxLocations < 0
          ? 0
          : Math.max(0, data.locationCount - plan.maxLocations)
        updateData.monthlyPrice = plan.price + (extraLocations * 15)
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

    // FIX MEDIUM: Ovij v transakcijo — prepreči desinhronizacijo naročnine in računa
    const subscription = await db.$transaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { id: data.id },
        data: updateData,
      })

      // Samodejno generiraj prvi mesečni račun ob aktivaciji
      if (data.status === 'active' && !data.plan) {
        const now = new Date()
        const periodEnd = new Date(now)
        periodEnd.setMonth(periodEnd.getMonth() + 1)
        const year = now.getFullYear()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        // FIX CRITICAL: Uporabi atomski counter namesto count + 1 (race condition)
        const seq = await getNextCounter('invoiceNumber')
        const invoiceNumber = `NAR-${year}${month}-${String(seq).padStart(4, '0')}`

        const amount = toNum(updated.monthlyPrice)
        const vatRate = 22
        const vatAmount = round2(multiply(amount, vatRate / 100))
        const totalAmount = round2(add(amount, vatAmount))
        const dueDate = new Date(now)
        dueDate.setDate(dueDate.getDate() + 15)

        await tx.subscriptionInvoice.create({
          data: {
            subscriptionId: updated.id,
            invoiceNumber,
            amount,
            vatRate,
            vatAmount,
            totalAmount,
            currency: updated.currency || 'EUR',
            periodStart: now,
            periodEnd,
            dueDate,
            status: 'pending',
          },
        })
      }

      return updated
    })

    return NextResponse.json(deepToNumbers(subscription))
  } catch (error: unknown) {
    return handleApiError(error, 'PATCH /api/subscription', 'Napaka pri posodabljanju naročnine')
  }
}
