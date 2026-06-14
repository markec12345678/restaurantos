'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Zaključek dneva (End of Day)
// Toast POS + Restaurant365 standard
// Celoten EOD proces: Z-poročilo, FURS, gotovina, DDV, povzetek
// Koordinator — poizvedbe, mutacije, delegiranje pod-komponentam
// ═══════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { CheckCircle2, FileText, Lock } from 'lucide-react'
import { useState, useCallback, memo } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import type { EODData } from './eod/constants'

// Lazy-loaded pod-komponente
const EodChecklist = dynamic(() => import('./eod/EodChecklist').then(m => ({ default: m.EodChecklist })), { ssr: false })
const EodKpiCards = dynamic(() => import('./eod/EodKpiCards').then(m => ({ default: m.EodKpiCards })), { ssr: false })
const EodSections = dynamic(() => import('./eod/EodSections').then(m => ({ default: m.EodSections })), { ssr: false })
const CloseDayDialog = dynamic(() => import('./eod/CloseDayDialog').then(m => ({ default: m.CloseDayDialog })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA - Koordinator
// ============================================
export const EndOfDayManager = memo(function EndOfDayManager() {
  const queryClient = useQueryClient()
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [actualCash, setActualCash] = useState('')
  const [eodNotes, setEodNotes] = useState('')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['orders', 'payments']))
  // EOD checklist — interaktivno potrjevanje namesto hardcoded false
  // Must be declared before any early returns to satisfy rules-of-hooks
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

  if (isLoading) {
    return (
      <div className="space-y-6 p-1">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!data) return null

  const eodChecks = [
    { label: 'Vsa naročila zaključena', done: data.orders.total === data.orders.completed + data.orders.cancelled },
    { label: 'FURS vsi računi overjeni', done: data.furs.allVerified },
    { label: 'Izmena zaprta', done: data.shift?.isClosed || false },
    { label: 'Gotovina usklajena', done: cashConfirmed },
    { label: 'Dnevni kontrolni seznam zaključen', done: checklistConfirmed },
  ]

  const completedChecks = eodChecks.filter(c => c.done).length
  const allChecksDone = eodChecks.every(c => c.done)

  const expectedCash = (data.shift?.startingCash || 0) + (data.shift?.cashSales || 0)

  return (
    <div className="space-y-6 overflow-y-auto h-full p-1 custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Zaključek dneva
          </h2>
          <p className="text-sm text-muted-foreground">
            {format(new Date(data.date), 'EEEE, dd. MMMM yyyy')} — Pregled in zaključek
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data.eodCompleted ? (
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-sm px-3 py-1">
              <CheckCircle2 className="h-4 w-4 mr-1" /> Dan zaključen
            </Badge>
          ) : (
            <Button onClick={() => setShowCloseDialog(true)} className="gap-1" disabled={!allChecksDone}>
              <Lock className="h-4 w-4" /> Zaključi dan
            </Button>
          )}
        </div>
      </div>

      {/* EOD Checklist */}
      <EodChecklist
        eodChecks={eodChecks}
        completedChecks={completedChecks}
        allChecksDone={allChecksDone}
        onToggleCash={handleToggleCash}
        onToggleChecklist={handleToggleChecklist}
      />

      {/* KPI Cards */}
      <EodKpiCards data={data} />

      {/* Expandable Sections */}
      <EodSections
        data={data}
        expandedSections={expandedSections}
        onToggleSection={toggleSection}
      />

      {/* Close Day Dialog */}
      <CloseDayDialog
        open={showCloseDialog}
        onOpenChange={setShowCloseDialog}
        actualCash={actualCash}
        onActualCashChange={handleActualCashChange}
        eodNotes={eodNotes}
        onEodNotesChange={handleEodNotesChange}
        expectedCash={expectedCash}
        startingCash={data.shift?.startingCash || 0}
        cashSales={data.shift?.cashSales || 0}
        isPending={closeDayMutation.isPending}
        onConfirm={() => closeDayMutation.mutate()}
      />
    </div>
  )
})
