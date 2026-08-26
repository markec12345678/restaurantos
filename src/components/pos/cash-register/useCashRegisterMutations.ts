'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { OpenShiftFormType, CloseShiftFormType } from './constants'

// ============================================
// HOOK: Mutacije za blagajno (odpri/zapri izmeno, EOD)
// ============================================

interface UseCashRegisterMutationsCallbacks {
  onCloseOpenDialog: () => void
  onCloseCloseDialog: () => void
  onCloseEodDialog: () => void
  onResetEodForm: () => void
}

export function useCashRegisterMutations({
  onCloseOpenDialog,
  onCloseCloseDialog,
  onCloseEodDialog,
  onResetEodForm,
}: UseCashRegisterMutationsCallbacks) {
  const queryClient = useQueryClient()

  // Zagotovi eodDate izven hooka (podan kot parameter kjer je potrebno)
  const openShiftMutation = useMutation({
    mutationFn: async (form: OpenShiftFormType) => {
      const res = await authFetch('/api/cash-register', {
        method: 'POST',
        body: JSON.stringify({
          startingCash: parseFloat(form.startingCash) || 0,
          employeeId: form.employeeId || null,
          employeeName: form.employeeName || '',
        }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Napaka' }))
        throw new Error(errorData.error || `Napaka (${res.status})`)
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Izmena odprta! Blagajna je aktivna.')
      onCloseOpenDialog()
      queryClient.invalidateQueries({ queryKey: queryKeys.cashRegister.all })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const closeShiftMutation = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: CloseShiftFormType }) => {
      const closingCash = parseFloat(form.closingCash)
      const res = await authFetch(`/api/cash-register/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          closingCash: isNaN(closingCash) ? 0 : closingCash,
          notes: form.notes,
        }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Napaka' }))
        throw new Error(errorData.error || `Napaka (${res.status})`)
      }
      return res.json()
    },
    onSuccess: (result) => {
      const diff = result.cashDifference
      if (Math.abs(diff) > 0.01) {
        toast.warning(`Izmena zaprta. Razlika v gotovini: €${diff.toFixed(2)}`)
      } else {
        toast.success('Izmena uspešno zaprta! Gotovina se ujema.')
      }
      onCloseCloseDialog()
      queryClient.invalidateQueries({ queryKey: queryKeys.cashRegister.all })
    },
    onError: () => toast.error('Napaka pri zapiranju izmene'),
  })

  const eodCloseMutation = useMutation({
    mutationFn: async ({ closingCash, notes, eodDate }: { closingCash: number; notes: string; eodDate: string }) => {
      const res = await authFetch('/api/reports/eod', {
        method: 'POST',
        body: JSON.stringify({ date: eodDate, closingCash, notes }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Napaka' }))
        throw new Error(errorData.error || `Napaka (${res.status})`)
      }
      return res.json()
    },
    onSuccess: (result) => {
      const diff = result.summary?.cashDifference
      if (diff && Math.abs(diff) > 0.01) {
        toast.warning(`Obratovalni dan zaključen! Razlika v gotovini: €${diff.toFixed(2)}`)
      } else {
        toast.success('Obratovalni dan uspešno zaključen!')
      }
      onCloseEodDialog()
      onResetEodForm()
      queryClient.invalidateQueries({ queryKey: queryKeys.cashRegister.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return {
    openShiftMutation,
    closeShiftMutation,
    eodCloseMutation,
  }
}
