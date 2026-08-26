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
  onPaymentSuccess: ((_orderId: string) => void) | undefined
  resetAndClose: () => void
}

// Shared types for payment execution functions
export interface OrderForPayment {
  id: string
  status?: string
  orderItems: OrderItem[]
}

export interface PaymentExecContext {
  queryClient: ReturnType<typeof useQueryClient>
  onPaymentSuccess: ((_orderId: string) => void) | undefined
  resetAndClose: () => void
}
