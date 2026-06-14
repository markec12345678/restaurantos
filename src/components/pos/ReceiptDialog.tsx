'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Eye } from 'lucide-react'
import { useState, useEffect, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { StornoDialog } from '@/components/pos/StornoDialog'
import { queryKeys } from '@/lib/query-keys'
import QRCode from 'qrcode'
import type { ReceiptData } from './receipt/constants'
import { useReceiptMutations } from './receipt/useReceiptMutations'

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
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
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

  // Generiraj QR kodo ko je račun davčno overjen
  useEffect(() => {
    if (!receipt?.fiscalVerified || !receipt.zoi) {
      queueMicrotask(() => setQrCodeDataUrl(''))
      return
    }

    const generateQR = async () => {
      try {
        // FURS QR vsebina: ZOI | datum | znesek | davčna št. | prostor | blagajna
        const dt = new Date(receipt.receiptDate)
        const day = String(dt.getDate()).padStart(2, '0')
        const month = String(dt.getMonth() + 1).padStart(2, '0')
        const year = dt.getFullYear()
        const hours = String(dt.getHours()).padStart(2, '0')
        const minutes = String(dt.getMinutes()).padStart(2, '0')
        const seconds = String(dt.getSeconds()).padStart(2, '0')
        const formattedDate = `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`

        // FIX MEDIUM: Only strip leading "SI" prefix (not "SI" elsewhere)
        const taxNumber = receipt.taxId.replace(/^SI/, '')
        const qrContent = [
          receipt.zoi,
          formattedDate,
          receipt.total.toFixed(2),
          taxNumber,
          receipt.businessId,
          receipt.registerId,
        ].join('|')

        const dataUrl = await QRCode.toDataURL(qrContent, {
          width: 120,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' },
          errorCorrectionLevel: 'M',
        })
        setQrCodeDataUrl(dataUrl)
      } catch {
        toast.error('Napaka pri generiranju QR kode')
        setQrCodeDataUrl('')
      }
    }

    generateQR()
  }, [receipt?.fiscalVerified, receipt?.zoi, receipt?.receiptDate, receipt?.total, receipt?.taxId, receipt?.businessId, receipt?.registerId])

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
