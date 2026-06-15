// Računi za Subscription API

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { getNextCounter } from '@/lib/counters'
import { calculateInvoiceAmounts } from './pricing'

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
