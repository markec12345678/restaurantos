'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useState } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { API_BASE } from '../constants'
import type { PrinterItem, FormData as PrinterFormData } from '../constants'

// ============================================
// HOOK: Mutacije za tiskalnike
// ============================================

export function usePrinterMutations() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPrinter, setEditingPrinter] = useState<PrinterItem | null>(null)
  const [formData, setFormData] = useState<PrinterFormData>({
    name: '',
    type: 'thermal',
    location: '',
    ipAddress: '',
    isActive: true,
    printRulesOrder: false,
    printRulesReceipt: false,
    printRulesPrepStationOrder: false,
  })

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch(API_BASE, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Tiskalnik uspešno ustvarjen')
      queryClient.invalidateQueries({ queryKey: queryKeys.configuration.byTab('printers') })
      setDialogOpen(false)
    },
    onError: () => toast.error('Napaka pri ustvarjanju tiskalnika'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Tiskalnik uspešno posodobljen')
      queryClient.invalidateQueries({ queryKey: queryKeys.configuration.byTab('printers') })
      setDialogOpen(false)
      setEditingPrinter(null)
    },
    onError: () => toast.error('Napaka pri posodobitvi tiskalnika'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`${API_BASE}/${id}`, { method: 'DELETE' })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Tiskalnik uspešno izbrisan')
      queryClient.invalidateQueries({ queryKey: queryKeys.configuration.byTab('printers') })
    },
    onError: () => toast.error('Napaka pri brisanju tiskalnika'),
  })

  return {
    dialogOpen, setDialogOpen,
    editingPrinter, setEditingPrinter,
    formData, setFormData,
    createMutation, updateMutation, deleteMutation,
  }
}
