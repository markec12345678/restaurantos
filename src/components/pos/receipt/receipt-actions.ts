'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'

// ============================================
// AKCIJSKI HANDLERJI ZA RAČUNE
// ============================================

interface UseReceiptActionsParams {
  orderId: string | null
  setIsPreview: (_v: boolean) => void
  saveReceiptMutateAsync: () => Promise<unknown>
  fiscalVerifyMutateAsync: () => Promise<unknown>
  markPrintedMutate: () => void
}

export function useReceiptActions({
  orderId,
  setIsPreview,
  saveReceiptMutateAsync,
  fiscalVerifyMutateAsync,
  markPrintedMutate,
}: UseReceiptActionsParams) {
  // Tiskaj račun (shrani + natisni)
  const handlePrint = useCallback(async () => {
    try {
      await saveReceiptMutateAsync()
    } catch {
      // Already handled by mutation
    }
    setIsPreview(false)
    window.print()
    markPrintedMutate()
  }, [saveReceiptMutateAsync, setIsPreview, markPrintedMutate])

  // Potrdi in natisni (shrani + FURS overitev + tiskaj)
  const handleConfirmAndPrint = useCallback(async () => {
    setIsPreview(false)
    try {
      await saveReceiptMutateAsync()
      await fiscalVerifyMutateAsync()
      window.print()
      markPrintedMutate()
    } catch {
      // Napaka pri overjanju ali shranjevanju -- ne tiskaj
    }
  }, [saveReceiptMutateAsync, fiscalVerifyMutateAsync, markPrintedMutate, setIsPreview])

  // Pošlji digitalni račun po e-pošti
  const handleSendEmail = useCallback(async () => {
    if (!orderId) return
    try {
      const res = await authFetch('/api/digital-receipt', {
        method: 'POST',
        body: JSON.stringify({ orderId, method: 'email' }),
      })
      if (res.ok) toast.success('Digitalni račun poslan po e-pošti!')
      else toast.error('Napaka pri pošiljanju')
    } catch { toast.error('Napaka pri pošiljanju') }
  }, [orderId])

  // Pošlji digitalni račun po SMS
  const handleSendSms = useCallback(async () => {
    if (!orderId) return
    try {
      const res = await authFetch('/api/digital-receipt', {
        method: 'POST',
        body: JSON.stringify({ orderId, method: 'sms' }),
      })
      if (res.ok) toast.success('Digitalni račun poslan po SMS!')
      else toast.error('Napaka pri pošiljanju')
    } catch { toast.error('Napaka pri pošiljanju') }
  }, [orderId])

  return {
    handlePrint,
    handleConfirmAndPrint,
    handleSendEmail,
    handleSendSms,
  }
}
