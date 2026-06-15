'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useCallback } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { SettingsData } from './constants'

// ============================================
// HOOK: Shrani nastavitve (mutacije in handlerji)
// ============================================

interface UseSettingsSaveParams {
  form: Partial<SettingsData>
  bulkVatFrom: string
  bulkVatTo: string
}

export function useSettingsSave({ form, bulkVatFrom, bulkVatTo }: UseSettingsSaveParams) {
  const queryClient = useQueryClient()

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<SettingsData>) => {
      const res = await authFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Napaka pri shranjevanju')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Nastavitve shranjene!')
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: () => toast.error('Napaka pri shranjevanju nastavitev'),
  })

  const handleSave = useCallback(() => {
    saveMutation.mutate(form)
  }, [form, saveMutation])

  const bulkVatMutation = useMutation({
    mutationFn: async ({ fromRate, toRate }: { fromRate: number; toRate: number }) => {
      const res = await authFetch('/api/menu-items/bulk-vat', {
        method: 'POST',
        body: JSON.stringify({ fromRate, toRate }),
      })
      if (!res.ok) throw new Error('Napaka pri masovni spremembi DDV')
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(`DDV stopnja posodobljena za ${data?.updated ?? 'vse'} artikle`)
      queryClient.invalidateQueries({ queryKey: queryKeys.menuItems.all })
    },
    onError: () => toast.error('Napaka pri masovni spremembi DDV'),
  })

  const handleBulkVatChange = useCallback(() => {
    const from = parseFloat(bulkVatFrom)
    const to = parseFloat(bulkVatTo)
    if (isNaN(from) || isNaN(to)) {
      toast.error('Izberite veljavne DDV stopnje')
      return
    }
    if (from === to) {
      toast.error('Sedanja in nova stopnja morata biti različni')
      return
    }
    bulkVatMutation.mutate({ fromRate: from, toRate: to })
  }, [bulkVatFrom, bulkVatTo, bulkVatMutation])

  return {
    saveMutation,
    bulkVatMutation,
    handleSave,
    handleBulkVatChange,
  }
}
