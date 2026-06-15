// Posodobitve naročnine

import { PLANS, type PlanKey } from './plans'
import { calculateMonthlyPrice } from './pricing'

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
