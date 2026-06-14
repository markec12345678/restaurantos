'use client'

// ─── Order Panel dialogi ───────────────────────────────────────
import { memo } from 'react'
import { ReceiptDialog } from '@/components/pos/ReceiptDialog'
import { PaymentDialog } from '@/components/pos/PaymentDialog'
import { VoidItemDialog } from '@/components/pos/VoidItemDialog'
import { StornoDialog } from '@/components/pos/StornoDialog'

export interface OrderDialogsProps {
  // Payment Dialog
  paymentDialogOpen: boolean
  onPaymentClose: () => void
  onPaymentSuccess: (_orderId: string) => void
  autoPayOrder: Record<string, unknown> | null
  selectedOrder: unknown
  // Receipt Dialog
  receiptOrderId: string | null
  onReceiptClose: () => void
  // Void Item Dialog
  voidItem: {
    id: string
    name: string
    quantity: number
    price: number
    vatRate: number
    voided: boolean
    orderId: string
  } | null
  onVoidClose: () => void
  onVoided: () => void
  // Storno Dialog
  stornoOrder: unknown
  onStornoClose: () => void
  onStornoComplete: () => void
}

export interface OrderDialogsOrderType {
  id: string
  orderNumber: number
  total: number
  subtotal: number
  tax: number
  discount: number
  tip: number
  paymentMethod: string
  paymentStatus: string
}

export const OrderDialogs = memo(function OrderDialogs({
  paymentDialogOpen,
  onPaymentClose,
  onPaymentSuccess,
  autoPayOrder,
  selectedOrder,
  receiptOrderId,
  onReceiptClose,
  voidItem,
  onVoidClose,
  onVoided,
  stornoOrder,
  onStornoClose,
  onStornoComplete,
}: OrderDialogsProps) {
  return (
    <>
      {/* Payment Dialog */}
      <PaymentDialog
        order={(autoPayOrder || selectedOrder) as Parameters<typeof PaymentDialog>[0]['order']}
        open={paymentDialogOpen}
        onClose={onPaymentClose}
        onPaymentSuccess={onPaymentSuccess}
      />
      {/* Receipt Dialog */}
      <ReceiptDialog
        orderId={receiptOrderId}
        open={!!receiptOrderId}
        onClose={onReceiptClose}
      />
      {/* Void Item Dialog */}
      <VoidItemDialog
        orderItem={voidItem}
        orderId={voidItem?.orderId || ''}
        open={!!voidItem}
        onClose={onVoidClose}
        onVoided={onVoided}
      />
      {/* Storno Dialog */}
      <StornoDialog
        order={stornoOrder as { id: string; orderNumber: number; total: number; subtotal: number; tax: number; discount: number; tip: number; paymentMethod: string; paymentStatus: string } | null}
        open={!!stornoOrder}
        onClose={onStornoClose}
        onStornoComplete={onStornoComplete}
      />
    </>
  )
})
