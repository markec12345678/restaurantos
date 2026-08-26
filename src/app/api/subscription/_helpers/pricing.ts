// Cenovni izračuni za Subscription API

import { round2, multiply, add } from '@/lib/decimal'
import { PLANS, type PlanKey } from './plans'

export function calculateMonthlyPrice(planKey: PlanKey, locationCount: number): number {
  const plan = PLANS[planKey]
  if (!plan) return 0
  const basePrice = plan.price
  // Enterprise plan ima maxLocations: -1 (neomejeno)
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
