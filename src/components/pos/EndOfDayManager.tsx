'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Zaključek dneva (End of Day)
// Koordinator — delegira podatke in prikaz pod-komponentam
// ═══════════════════════════════════════════════════════════════

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle2, FileText, Lock } from 'lucide-react'
import { memo } from 'react'
import { format } from 'date-fns'
import dynamic from 'next/dynamic'
import { useEodData } from './eod/useEodData'

// Lazy-loaded pod-komponente
const EodChecklist = dynamic(() => import('./eod/EodChecklist').then(m => ({ default: m.EodChecklist })), { ssr: false })
const EodKpiCards = dynamic(() => import('./eod/EodKpiCards').then(m => ({ default: m.EodKpiCards })), { ssr: false })
const EodSections = dynamic(() => import('./eod/EodSections').then(m => ({ default: m.EodSections })), { ssr: false })
const CloseDayDialog = dynamic(() => import('./eod/CloseDayDialog').then(m => ({ default: m.CloseDayDialog })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA - Koordinator
// ============================================
export const EndOfDayManager = memo(function EndOfDayManager() {
  const {
    data, isLoading,
    showCloseDialog, setShowCloseDialog,
    actualCash, eodNotes,
    expandedSections, cashConfirmed, checklistConfirmed,
    closeDayMutation,
    toggleSection, handleToggleCash, handleToggleChecklist,
    handleActualCashChange, handleEodNotesChange,
  } = useEodData()

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

      <EodChecklist eodChecks={eodChecks} completedChecks={completedChecks} allChecksDone={allChecksDone} onToggleCash={handleToggleCash} onToggleChecklist={handleToggleChecklist} />
      <EodKpiCards data={data} />
      <EodSections data={data} expandedSections={expandedSections} onToggleSection={toggleSection} />
      <CloseDayDialog
        open={showCloseDialog} onOpenChange={setShowCloseDialog}
        actualCash={actualCash} onActualCashChange={handleActualCashChange}
        eodNotes={eodNotes} onEodNotesChange={handleEodNotesChange}
        expectedCash={expectedCash} startingCash={data.shift?.startingCash || 0}
        cashSales={data.shift?.cashSales || 0} isPending={closeDayMutation.isPending}
        onConfirm={() => closeDayMutation.mutate()}
      />
    </div>
  )
})
