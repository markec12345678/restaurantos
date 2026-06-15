'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { toast } from 'sonner'
import { format } from 'date-fns'
import type { ZReportData } from './zreport/constants'

export function useZReportManager() {
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [actualCash, setActualCash] = useState('')
  const [closeNotes, setCloseNotes] = useState('')

  const { data: reports, isLoading } = useQuery({
    queryKey: queryKeys.zReport.all,
    queryFn: async () => {
      const res = await authFetch('/api/z-report')
      return res.json()
    },
  })

  const { data: currentReport, isLoading: loadingReport } = useQuery({
    queryKey: [...queryKeys.zReport.current, selectedDate],
    queryFn: async () => {
      const res = await authFetch(`/api/z-report?date=${selectedDate}`)
      const data = await res.json()
      return data.length > 0 ? data[0] : null
    },
  })

  const generateMutation = useMutation({
    mutationFn: async (finalize: boolean) => {
      const res = await authFetch('/api/z-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          actualCash: parseFloat(actualCash) || 0,
          notes: closeNotes,
          finalize,
        }),
      })
      if (!res.ok) throw new Error('Napaka pri generiranju Z-poročila')
      return res.json()
    },
    onSuccess: (_, finalize) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.zReport.current })
      queryClient.invalidateQueries({ queryKey: queryKeys.zReport.all })
      toast.success(finalize ? 'Z-poročilo zaključeno!' : 'Z-poročilo generirano!')
      setShowCloseDialog(false)
    },
    onError: () => toast.error('Napaka pri generiranju Z-poročila'),
  })

  const report = currentReport as ZReportData | null

  const handleDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value)
  }, [])

  const handleOpenCloseDialog = useCallback(() => {
    setShowCloseDialog(true)
  }, [])

  const handleCloseDialogOpenChange = useCallback((open: boolean) => {
    setShowCloseDialog(open)
  }, [])

  const handleGenerate = useCallback(() => {
    generateMutation.mutate(false)
  }, [generateMutation])

  const handleFinalize = useCallback(() => {
    generateMutation.mutate(true)
  }, [generateMutation])

  const handleActualCashChange = useCallback((value: string) => {
    setActualCash(value)
  }, [])

  const handleCloseNotesChange = useCallback((value: string) => {
    setCloseNotes(value)
  }, [])

  const handleSelectDate = useCallback((date: string) => {
    setSelectedDate(date)
  }, [])

  return {
    selectedDate,
    showCloseDialog,
    actualCash,
    closeNotes,
    reports,
    isLoading,
    report,
    loadingReport,
    generateMutation,
    handleDateChange,
    handleOpenCloseDialog,
    handleCloseDialogOpenChange,
    handleGenerate,
    handleFinalize,
    handleActualCashChange,
    handleCloseNotesChange,
    handleSelectDate,
  }
}
