'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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

// ============================================
// LAZY-NALOŽENE PODKOMPONENTE
// ============================================
const ActionButtons = dynamic(
  () => import('./receipt/ActionButtons').then(m => m.ActionButtons),
  { ssr: false }
)
const ReceiptContent = dynamic(
  () => import('./receipt/ReceiptContent').then(m => m.ReceiptContent),
  { ssr: false }
)

// ============================================
// GLAVNA KOMPONENTA
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
  const [verifying, setVerifying] = useState(false)
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

  // Shrani račun v bazo
  const saveReceipt = useMutation({
    mutationFn: async () => {
      if (!orderId) return null
      const res = await authFetch(`/api/receipts/${orderId}`, { method: 'POST' })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.receipt.byOrder(orderId as string) })
    },
  })

  // Označi kot natisnjen
  const markPrinted = useMutation({
    mutationFn: async () => {
      if (!orderId) return null
      const res = await authFetch(`/api/receipts/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({ printed: true }),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
  })

  // Ustvari kopijo
  const markCopy = useMutation({
    mutationFn: async () => {
      if (!orderId) return null
      const res = await authFetch(`/api/receipts/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({ isCopy: true }),
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.receipt.byOrder(orderId as string) })
    },
  })

  // FURS davčno overjanje
  const fiscalVerify = useMutation({
    mutationFn: async () => {
      if (!orderId) return null
      setVerifying(true)
      const res = await authFetch('/api/furs', {
        method: 'POST',
        body: JSON.stringify({ orderId }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Napaka pri overjanju')
      return result
    },
    onSuccess: (result) => {
      setVerifying(false)
      toast.success(result.message || 'Račun davčno overjen!')
      queryClient.invalidateQueries({ queryKey: queryKeys.receipt.byOrder(orderId as string) })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
    },
    onError: (err: Error) => {
      setVerifying(false)
      toast.error(`Napaka pri overjanju: ${err.message}`)
    },
  })

  // Storno - odpre StornoDialog z razlogom
  const handleStorno = useCallback(() => {
    setStornoDialogOpen(true)
  }, [])

  const handlePrint = async () => {
    // Najprej shrani račun
    try {
      await saveReceipt.mutateAsync()
    } catch {
      // Already handled by mutation
    }
    setIsPreview(false)
    window.print()
    markPrinted.mutate()
  }

  const handleConfirmAndPrint = async () => {
    setIsPreview(false)
    try {
      await saveReceipt.mutateAsync()
      // Avtomatsko zaženi FURS overitev
      await fiscalVerify.mutateAsync()
      window.print()
      markPrinted.mutate()
    } catch {
      // Napaka pri overjanju ali shranjevanju — ne tiskaj
    }
  }

  // Pošlji digitalni račun po e-pošti
  const handleSendEmail = async () => {
    if (!orderId) return
    try {
      const res = await authFetch('/api/digital-receipt', {
        method: 'POST',
        body: JSON.stringify({ orderId, method: 'email' }),
      })
      if (res.ok) {
        toast.success('Digitalni račun poslan po e-pošti!')
      } else {
        toast.error('Napaka pri pošiljanju')
      }
    } catch {
      toast.error('Napaka pri pošiljanju')
    }
  }

  // Pošlji digitalni račun po SMS
  const handleSendSms = async () => {
    if (!orderId) return
    try {
      const res = await authFetch('/api/digital-receipt', {
        method: 'POST',
        body: JSON.stringify({ orderId, method: 'sms' }),
      })
      if (res.ok) {
        toast.success('Digitalni račun poslan po SMS!')
      } else {
        toast.error('Napaka pri pošiljanju')
      }
    } catch {
      toast.error('Napaka pri pošiljanju')
    }
  }

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
            {/* PREDOGLED OPOZORILO */}
            {isPreview && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center gap-2 text-sm">
                <Eye className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-amber-800 dark:text-amber-200">
                  To je <strong>predogled</strong> računa. Preverite podatke pred tiskanjem.
                  Račun bo shranjen v bazo ob potrditvi.
                </span>
              </div>
            )}

            {/* STORNO OZNAKA */}
            {receipt.isStorno && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-center font-bold text-red-700 dark:text-red-300">
                STORNO RAČUN
                {receipt.stornoOf && <div className="text-xs font-normal mt-1">Storno računa: {receipt.stornoOf}</div>}
              </div>
            )}

            {/* KOPIJA OZNAKA */}
            {receipt.isCopy && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-2 text-center text-xs font-medium text-blue-700 dark:text-blue-300">
                PRIREJENA KOPIJA / Kopie certifiée
              </div>
            )}

            {/* === VSEBINA RAČUNA === */}
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
