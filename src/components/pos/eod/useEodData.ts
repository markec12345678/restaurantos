'use client'

// ============================================
// HOOK: EOD podatki — poizvedbe in mutacije
// Izvlečeno iz EndOfDayManager.tsx
// ============================================

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { EODData } from './constants'

export function useEodData() {
  const queryClient = useQueryClient()
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [actualCash, setActualCash] = useState('')
  const [eodNotes, setEodNotes] = useState('')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['orders', 'payments']))
  const [cashConfirmed, setCashConfirmed] = useState(false)
  const [checklistConfirmed, setChecklistConfirmed] = useState(false)

  const { data, isLoading, refetch: _refetch } = useQuery<EODData>({
    queryKey: queryKeys.endOfDay.all,
    queryFn: async () => {
      const res = await authFetch('/api/end-of-day')
      return res.json()
    },
  })

  const closeDayMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch('/api/end-of-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: data?.date || new Date().toISOString().split('T')[0],
          actualCash: parseFloat(actualCash) || 0,
          notes: eodNotes,
        }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Napaka' }))
        throw new Error(errorData.error || `Napaka (${res.status})`)
      }
      return res.json()
    },
    onSuccess: (result) => {
      toast.success(result.message || 'Dan uspešno zaključen!')
      setShowCloseDialog(false)
      queryClient.invalidateQueries({ queryKey: queryKeys.endOfDay.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
    onError: () => toast.error('Napaka pri zaključku dneva'),
  })

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }, [])

  const handleToggleCash = useCallback(() => setCashConfirmed(v => !v), [])
  const handleToggleChecklist = useCallback(() => setChecklistConfirmed(v => !v), [])
  const handleActualCashChange = useCallback((v: string) => setActualCash(v), [])
  const handleEodNotesChange = useCallback((v: string) => setEodNotes(v), [])

  return {
    data,
    isLoading,
    showCloseDialog,
    setShowCloseDialog,
    actualCash,
    eodNotes,
    expandedSections,
    cashConfirmed,
    checklistConfirmed,
    closeDayMutation,
    toggleSection,
    handleToggleCash,
    handleToggleChecklist,
    handleActualCashChange,
    handleEodNotesChange,
  }
}
