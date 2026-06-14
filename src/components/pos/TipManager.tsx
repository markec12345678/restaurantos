'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Tip Manager / Upravitelj napitnin
// Toast POS standard — distribucija napitnin med zaposlene
// Equal, Hours, Points, Manual distribucija
// ═══════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { DollarSign, HandCoins, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import { format, addDays, subDays } from 'date-fns'
import { toast } from 'sonner'
import type { TipPoolData } from './tip/constants'

// Lazy-loaded sub-komponente
const TipLoadingSkeleton = dynamic(() => import('./tip/TipLoadingSkeleton').then((m) => m.TipLoadingSkeleton), { ssr: false })
const TipSummaryCards = dynamic(() => import('./tip/TipSummaryCards').then((m) => m.TipSummaryCards), { ssr: false })
const TipMethodStatus = dynamic(() => import('./tip/TipMethodStatus').then((m) => m.TipMethodStatus), { ssr: false })
const TipDistributionTable = dynamic(() => import('./tip/TipDistributionTable').then((m) => m.TipDistributionTable), { ssr: false })
const TipDistributionChart = dynamic(() => import('./tip/TipDistributionChart').then((m) => m.TipDistributionChart), { ssr: false })
const TipEmptyState = dynamic(() => import('./tip/TipEmptyState').then((m) => m.TipEmptyState), { ssr: false })
const TipGenerateDialog = dynamic(() => import('./tip/TipGenerateDialog').then((m) => m.TipGenerateDialog), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export const TipManager = memo(function TipManager() {
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [method, setMethod] = useState('equal')
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [editingAmounts, setEditingAmounts] = useState<Record<string, string>>({})

  // Pridobi tip poole
  const { data: _pools, isLoading } = useQuery({
    queryKey: queryKeys.tipPool.all,
    queryFn: async () => {
      const res = await authFetch('/api/tip-pool')
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })

  // Pridobi trenutni pool
  const { data: currentPool } = useQuery({
    queryKey: queryKeys.tipPool.byDate(selectedDate),
    queryFn: async () => {
      const res = await authFetch(`/api/tip-pool?date=${selectedDate}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      const data = await res.json()
      return data.length > 0 ? data[0] : null
    },
  })

  // Generiraj tip pool
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch('/api/tip-pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, distributionMethod: method }),
      })
      if (!res.ok) throw new Error('Napaka pri generiranju')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tip-pool'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.tipPool.all })
      toast.success('Tip pool generiran!')
      setShowGenerateDialog(false)
    },
    onError: () => toast.error('Napaka pri generiranju tip poola'),
  })

  // Shrani ročne zneske
  const saveManualMutation = useMutation({
    mutationFn: async () => {
      const pool = currentPool as TipPoolData
      if (!pool) return
      const distributions = pool.distributions.map(d => ({
        employeeId: d.employeeId,
        employeeName: d.employeeName,
        hoursWorked: d.hoursWorked,
        points: d.points,
        amount: parseFloat(editingAmounts[d.employeeId] ?? String(d.amount)) || 0,
      }))
      const res = await authFetch('/api/tip-pool', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipPoolId: pool.id, distributions }),
      })
      if (!res.ok) throw new Error('Napaka pri shranjevanju')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tipPool.byDate(selectedDate) })
      toast.success('Napitnine shranjene!')
    },
    onError: () => toast.error('Napaka pri shranjevanju'),
  })

  const pool = currentPool as TipPoolData | null

  // Handlerji
  const handleDatePrev = useCallback(() => {
    setSelectedDate(format(subDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))
  }, [selectedDate])

  const handleDateNext = useCallback(() => {
    setSelectedDate(format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))
  }, [selectedDate])

  const handleAmountChange = useCallback((employeeId: string, value: string) => {
    setEditingAmounts(prev => ({ ...prev, [employeeId]: value }))
  }, [])

  const handleGenerateDialogOpenChange = useCallback((open: boolean) => {
    setShowGenerateDialog(open)
  }, [])

  // Nalaganje
  if (isLoading) {
    return <TipLoadingSkeleton />
  }

  return (
    <div className="space-y-4 p-2 overflow-y-auto h-full custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <HandCoins className="h-6 w-6 text-green-500" />
            Upravitelj napitnin
          </h2>
          <p className="text-muted-foreground">Distribucija napitnin med zaposlene</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label="Nazaj" onClick={handleDatePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-40" id="tip-date" />
            <Button variant="outline" size="icon" aria-label="Naprej" onClick={handleDateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {!pool && (
            <Button onClick={() => setShowGenerateDialog(true)}>
              <DollarSign className="h-4 w-4 mr-2" />
              Generiraj
            </Button>
          )}
        </div>
      </div>

      {pool && (
        <>
          {/* Povzetek */}
          <TipSummaryCards
            totalTips={pool.totalTips}
            cashTips={pool.cashTips}
            cardTips={pool.cardTips}
            employeeCount={pool.distributions.length}
          />

          {/* Metoda + Status */}
          <TipMethodStatus
            distributionMethod={pool.distributionMethod}
            status={pool.status}
          />

          {/* Distribucija */}
          <TipDistributionTable
            pool={pool}
            editingAmounts={editingAmounts}
            onAmountChange={handleAmountChange}
            onSaveManual={() => saveManualMutation.mutate()}
            isSavePending={saveManualMutation.isPending}
          />

          {/* Vizualizacija */}
          <TipDistributionChart pool={pool} />
        </>
      )}

      {!pool && (
        <TipEmptyState
          selectedDate={selectedDate}
          onGenerate={() => setShowGenerateDialog(true)}
        />
      )}

      {/* Dialog za generiranje */}
      <TipGenerateDialog
        open={showGenerateDialog}
        onOpenChange={handleGenerateDialogOpenChange}
        method={method}
        onMethodChange={setMethod}
        onGenerate={() => generateMutation.mutate()}
        isPending={generateMutation.isPending}
      />
    </div>
  )
})
