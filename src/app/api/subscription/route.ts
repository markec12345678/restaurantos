
// =====================================================================
// SUBSCRIPTION API — SaaS naročnina
// Paketi: Starter (29€), Professional (49€), Enterprise (99€)
// =====================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { toNum, deepToNumbers } from '@/lib/decimal'
import { handleApiError, validateRequest } from '@/lib/api-utils'
import {

  PLANS,
  type PlanKey,
  createSubscriptionSchema,
  updateSubscriptionSchema,
  calculateMonthlyPrice,
  createTrialInvoice,
  createActivationInvoice,
  buildSubscriptionUpdateData,
} from './_helpers'

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
    const monthlyPrice = calculateMonthlyPrice(data.plan as PlanKey, data.locationCount)

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
    await createTrialInvoice(subscription.id, now, trialEnd)

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

    const { data, error: validationError } = await validateRequest(req, updateSubscriptionSchema)
    if (validationError) return validationError

    const updateData = buildSubscriptionUpdateData(data)

    // FIX MEDIUM: Ovij v transakcijo — prepreči desinhronizacijo naročnine in računa
    const subscription = await db.$transaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { id: data.id },
        data: updateData,
      })

      // Samodejno generiraj prvi mesečni račun ob aktivaciji
      if (data.status === 'active' && !data.plan) {
        await createActivationInvoice(tx, updated.id, toNum(updated.monthlyPrice), updated.currency || 'EUR')
      }

      return updated
    })

    return NextResponse.json(deepToNumbers(subscription))
  } catch (error: unknown) {
    return handleApiError(error, 'PATCH /api/subscription', 'Napaka pri posodabljanju naročnine')
  }
}
