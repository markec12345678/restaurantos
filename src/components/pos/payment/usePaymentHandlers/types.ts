'use client'

import type { useQueryClient } from '@tanstack/react-query'

// ============================================
// TIPI
// ============================================
interface OrderItem {
  id: string
  price: number
  quantity: number
}

interface Order {
  id: string
  status?: string
  // P2-UX (stale order): optimistic locking — glej PUT /api/orders expectedUpdatedAt
  updatedAt?: string
  orderItems: OrderItem[]
}

export interface PaymentHandlersProps {
  order: Order | null | undefined
  isProcessing: boolean
  setIsProcessing: (_processing: boolean) => void
  orderTotal: number
  tipAmount: number
  splitCount: number
  paymentMethod: string
  splitAmount: number
  guestAssignments: Record<string, number>
  /** RUNDA 46: zvestobni račun za EARN ob deljenem plačilu (prej split NIKOLI
   *  ni pripel točk — tiha izguba za goste na deljenih računih). null = brez. */
  loyaltyAccountId?: string | null
  /** RUNDA 49: unovčenje (redeem) ob deljenem/po-artiklih plačilu — vsako delno
   *  plačilo gre kot type 'loyalty' s svojim številom točk (parity z Eno
   *  plačilo, kjer je to 'loyalty' način). Zahteva loyaltyAccountId. */
  loyaltyRedeem?: boolean
  /** RUNDA 49: stanje točk izbranega računa (za odjavo preverjanje pred začetkom —
   *  prepreči pol-failed split: gost 1 unovči, gost 2 pada na "Ni dovolj točk").
   *  null = stanje ni znano → samo backend varovalka. */
  loyaltyBalance?: number | null
  /** RUNDA 49: vrednost ene točke v EUR (normalizirano > 0) — za izračun točk */
  pointsValue?: number
  onPaymentSuccess: ((_orderId: string) => void) | undefined
  resetAndClose: () => void
}

// Shared types for payment execution functions
export interface OrderForPayment {
  id: string
  status?: string
  // P2-UX (stale order): optimistic locking — glej PUT /api/orders expectedUpdatedAt
  updatedAt?: string
  orderItems: OrderItem[]
}

export interface PaymentExecContext {
  queryClient: ReturnType<typeof useQueryClient>
  onPaymentSuccess: ((_orderId: string) => void) | undefined
  resetAndClose: () => void
}
