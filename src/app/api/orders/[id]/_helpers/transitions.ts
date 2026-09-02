// Status transitions state machine — prepreči nazadovanje statusa

import { NextResponse } from 'next/server'

export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  // FIX: 'pending' → 'completed' dovoljen (takeaway plačilo pred fired)
  // Scenarij: stranka plača takoj (takeaway/delivery) brez prejšnjega fired
  'pending': ['in-progress', 'completed', 'cancelled'],
  'in-progress': ['ready', 'completed', 'cancelled'],
  'ready': ['completed', 'cancelled'],
  'completed': [], // Completed orders CANNOT change status (one-way)
  'cancelled': [],  // Cancelled orders CANNOT be revived
}

export const VALID_PAYMENT_TRANSITIONS: Record<string, string[]> = {
  'unpaid': ['partial', 'paid'],
  'partial': ['paid'],
  'paid': ['storno'],
  'storno': [],
}

// Preveri veljavnost prehoda statusa in plačilnega statusa
export function validateOrderTransitions(
  existingOrder: { status: string; paymentStatus: string },
  data: { status?: string; paymentStatus?: string },
): NextResponse | null {
  if (data.status && data.status !== existingOrder.status) {
    const allowedTransitions = VALID_STATUS_TRANSITIONS[existingOrder.status] || []
    if (!allowedTransitions.includes(data.status)) {
      return NextResponse.json(
        { error: `Prehod iz '${existingOrder.status}' v '${data.status}' ni dovoljen. Dovoljeni: [${allowedTransitions.join(', ')}]` },
        { status: 400 }
      )
    }
  }

  if (data.paymentStatus && data.paymentStatus !== existingOrder.paymentStatus) {
    const allowed = VALID_PAYMENT_TRANSITIONS[existingOrder.paymentStatus] || []
    if (!allowed.includes(data.paymentStatus)) {
      return NextResponse.json(
        { error: `Plačilni prehod iz '${existingOrder.paymentStatus}' v '${data.paymentStatus}' ni dovoljen` },
        { status: 400 }
      )
    }
  }

  return null
}
