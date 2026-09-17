'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { useReceiptActions } from './receipt-actions'

// ============================================
// HOOK: Mutacije za račune (shrani, natisni, kopiraj, FURS)
// ============================================

interface UseReceiptMutationsParams {
  orderId: string | null
  setIsPreview: (_v: boolean) => void
  onStornoComplete: () => void
}

export function useReceiptMutations({
  orderId,
  setIsPreview,
  onStornoComplete: _onStornoComplete,
}: UseReceiptMutationsParams) {
  const queryClient = useQueryClient()
  const [verifying, setVerifying] = useState(false)
  const [cisSubmitting, setCisSubmitting] = useState(false)

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
      // FIX NAPAKA 5 (HTTP 403): Če uporabnik nima admin dovoljenja za FURS,
      // prikaži jasno sporočilo namesto generične napake.
      const msg = err.message.toLowerCase()
      if (msg.includes('dovoljen') || msg.includes('403') || msg.includes('forbidden')) {
        toast.warning('FURS overjanje zahteva admin dovoljenje. Račun lahko overite kasneje.', { duration: 5000 })
      } else {
        toast.error(`Napaka pri overjanju: ${err.message}`)
      }
    },
  })

  // CIS (FINA, HR) ponovna oddaja računa — runda 29. Avto-oddaja se zgodi
  // strežno ob ustvarjanju računa; ta mutacija je retry pot za pending/failed.
  const cisSubmit = useMutation({
    mutationFn: async () => {
      if (!orderId) return null
      setCisSubmitting(true)
      const res = await authFetch('/api/cis/submit-invoice', {
        method: 'POST',
        body: JSON.stringify({ orderId }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Napaka pri oddaji')
      return result as { ok: boolean; jir?: string; serverErrorCode?: string; reason?: string }
    },
    onSuccess: (result) => {
      setCisSubmitting(false)
      queryClient.invalidateQueries({ queryKey: queryKeys.receipt.byOrder(orderId as string) })
      if (result?.ok && result.jir) {
        toast.success(`Račun fiskaliziran — JIR: ${result.jir}`)
      } else if (result?.serverErrorCode) {
        toast.warning(`FINA je zavrnila oddajo (${result.serverErrorCode}) — poskusite znova`, { duration: 6000 })
      } else {
        toast.info(result?.reason === 'no-cert-config'
          ? 'FINA P12 certifikat ni nastavljen — oddaja bo možna po konfiguraciji'
          : 'Oddaja ni bila izvedena')
      }
    },
    onError: (err: Error) => {
      setCisSubmitting(false)
      toast.error(`Napaka pri oddaji na FINA: ${err.message}`)
    },
  })

  const { handlePrint, handleConfirmAndPrint, handleSendEmail, handleSendSms } = useReceiptActions({
    orderId,
    setIsPreview,
    saveReceiptMutateAsync: saveReceipt.mutateAsync,
    fiscalVerifyMutateAsync: fiscalVerify.mutateAsync,
    markPrintedMutate: () => markPrinted.mutate(),
  })

  return {
    verifying,
    saveReceipt,
    markPrinted,
    markCopy,
    fiscalVerify,
    cisSubmit,
    cisSubmitting,
    handlePrint,
    handleConfirmAndPrint,
    handleSendEmail,
    handleSendSms,
  }
}
