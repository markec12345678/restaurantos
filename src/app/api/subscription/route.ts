import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

// =====================================================================
// SUBSCRIPTION API — SaaS naročnina
// Paketi: Starter (29€), Professional (49€), Enterprise (99€)
// =====================================================================

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
        totalRevenue: totalRevenue._sum.totalAmount || 0,
      },
    })
  } catch (error) {
    console.error('Subscription GET error:', error)
    return NextResponse.json({ error: 'Napaka pri pridobivanju naročnine' }, { status: 500 })
  }
}

// POST /api/subscription — Ustvari/nadgradnja naročnino
export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json()
    const schema = z.object({
      companyName: z.string().min(1, 'Ime podjetja je obvezno').max(200),
      email: z.string().email('Veljaven email je obvezen'),
      phone: z.string().max(50).default(''),
      taxId: z.string().max(50).default(''),
      businessId: z.string().max(50).default(''),
      plan: z.enum(['starter', 'professional', 'enterprise']),
      paymentMethod: z.enum(['card', 'bank_transfer', 'invoice']).default('bank_transfer'),
      locationCount: z.number().int().min(1).default(1),
    })

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neveljavni podatki', validationErrors: parsed.error.issues }, { status: 400 })
    }

    const data = parsed.data
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
    const extraLocations = Math.max(0, data.locationCount - plan.maxLocations)
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
      const count = await db.subscriptionInvoice.count()
      const invoiceNumber = `NAR-${year}${month}-${String(count + 1).padStart(4, '0')}`

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
    } catch (e) {
      console.error('Auto-invoice creation error:', e)
    }

    return NextResponse.json(subscription, { status: 201 })
  } catch (error) {
    console.error('Subscription POST error:', error)
    return NextResponse.json({ error: 'Napaka pri ustvarjanju naročnine' }, { status: 500 })
  }
}

// PATCH /api/subscription — Nadgradnja/sprememba paketa
export async function PATCH(req: Request) {
  try {
    const authResult = await requireAuth(req, { permission: 'admin' })
    if (authResult.error) return authResult.error

    const body = await req.json()
    const schema = z.object({
      id: z.string().min(1),
      plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
      status: z.enum(['trial', 'active', 'past_due', 'cancelled', 'expired']).optional(),
      locationCount: z.number().int().min(1).optional(),
      paymentMethod: z.enum(['card', 'bank_transfer', 'invoice']).optional(),
    })

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Neveljavni podatki' }, { status: 400 })
    }

    const data = parsed.data
    const updateData: Record<string, unknown> = {}

    if (data.plan) {
      const plan = PLANS[data.plan as PlanKey]
      updateData.plan = data.plan
      if (data.locationCount) {
        const extraLocations = Math.max(0, data.locationCount - plan.maxLocations)
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

      // Samodejno generiraj prvi mesečni račun ob aktivaciji
      try {
        const sub = await db.subscription.findUnique({ where: { id: data.id } })
        if (sub) {
          const year = now.getFullYear()
          const month = String(now.getMonth() + 1).padStart(2, '0')
          const count = await db.subscriptionInvoice.count()
          const invoiceNumber = `NAR-${year}${month}-${String(count + 1).padStart(4, '0')}`

          const amount = sub.monthlyPrice
          const vatRate = 22
          const vatAmount = Math.round(amount * vatRate / 100 * 100) / 100
          const totalAmount = Math.round((amount + vatAmount) * 100) / 100
          const dueDate = new Date(now)
          dueDate.setDate(dueDate.getDate() + 15)

          await db.subscriptionInvoice.create({
            data: {
              subscriptionId: sub.id,
              invoiceNumber,
              amount,
              vatRate,
              vatAmount,
              totalAmount,
              currency: sub.currency || 'EUR',
              periodStart: now,
              periodEnd,
              dueDate,
              status: 'pending',
            },
          })
        }
      } catch (e) {
        console.error('Auto-invoice on activation error:', e)
      }
    }

    if (data.status === 'cancelled') {
      updateData.cancelledAt = new Date()
    }

    const subscription = await db.subscription.update({
      where: { id: data.id },
      data: updateData,
    })

    return NextResponse.json(subscription)
  } catch (error) {
    console.error('Subscription PATCH error:', error)
    return NextResponse.json({ error: 'Napaka pri posodabljanju naročnine' }, { status: 500 })
  }
}
