'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Eye } from 'lucide-react'
import { useState, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import { authFetch } from '@/components/pos/PinLogin'
import { StornoDialog } from '@/components/pos/StornoDialog'
import { queryKeys } from '@/lib/query-keys'
import type { ReceiptData } from './receipt/constants'
import { useReceiptMutations } from './receipt/useReceiptMutations'
import { useQrCode } from './receipt/useQrCode'

// Lazy-loaded podkomponente
const ActionButtons = dynamic(() => import('./receipt/ActionButtons').then(m => ({ default: m.ActionButtons })), { ssr: false })
const StatusBadges = dynamic(() => import('./receipt/StatusBadges').then(m => ({ default: m.StatusBadges })), { ssr: false })
const ReceiptContent = dynamic(() => import('./receipt/ReceiptContent').then(m => ({ default: m.ReceiptContent })), { ssr: false })

// ============================================
// KOMPONENTA
// ============================================
export const ReceiptDialog = memo(function ReceiptDialog({
  orderId,
  open,
  onClose,
}: {
  orderId: string | null
  open: boolean
  onClose: () => void
}) {
  const [isPreview, setIsPreview] = useState(true)
  const [stornoDialogOpen, setStornoDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: receipt, isLoading } = useQuery({
    queryKey: queryKeys.receipt.byOrder(orderId as string),
    queryFn: async () => {
      if (!orderId) return null
      const res = await authFetch(`/api/receipts/${orderId}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json() as Promise<ReceiptData>
    },
    enabled: !!orderId && open,
  })

  const qrCodeDataUrl = useQrCode(receipt ?? undefined)

  // ============================================
  // MUTATIONS (podedovane iz pod-hooka)
  // ============================================
  const {
    verifying,
    markCopy,
    fiscalVerify,
    handleConfirmAndPrint,
    handlePrint,
    handleSendEmail,
    handleSendSms,
  } = useReceiptMutations({
    orderId,
    setIsPreview,
    onStornoComplete: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.receipt.byOrder(orderId as string) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      onClose()
    },
  })

  // Storno - odpre StornoDialog z razlogom
  const handleStorno = useCallback(() => {
    setStornoDialogOpen(true)
  }, [])

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              {isPreview ? (
                <><Eye className="h-4 w-4" /> Predogled računa</>
              ) : (
                'Račun'
              )}
            </span>
            <ActionButtons
              isPreview={isPreview}
              receipt={receipt}
              verifying={verifying}
              onConfirmAndPrint={handleConfirmAndPrint}
              onPrint={handlePrint}
              onCopy={() => markCopy.mutate()}
              onFiscalVerify={() => fiscalVerify.mutate()}
              onStorno={handleStorno}
              onSendEmail={handleSendEmail}
              onSendSms={handleSendSms}
            />
          </DialogTitle>
        </DialogHeader>

        {isLoading || !receipt ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-6 bg-muted rounded" />
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-32 bg-muted rounded" />
            <div className="h-8 bg-muted rounded" />
          </div>
        ) : (
          <>
            <StatusBadges isPreview={isPreview} receipt={receipt} />
            <ReceiptContent receipt={receipt} qrCodeDataUrl={qrCodeDataUrl} />
          </>
        )}
      </DialogContent>

      {/* Storno Dialog - odpre se iz ReceiptDialog */}
      <StornoDialog
        order={orderId && receipt ? {
          id: orderId,
          orderNumber: receipt.orderNumber,
          total: receipt.total,
          subtotal: receipt.subtotal,
          tax: receipt.totalVat,
          discount: receipt.discount,
          tip: receipt.tip,
          paymentMethod: receipt.paymentMethod,
          paymentStatus: receipt.paymentStatus,
        } : null}
        open={stornoDialogOpen}
        onClose={() => setStornoDialogOpen(false)}
        onStornoComplete={() => {
          queryClient.invalidateQueries({ queryKey: queryKeys.receipt.byOrder(orderId as string) })
          queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
          onClose()
        }}
      />
    </Dialog>
  )
})
