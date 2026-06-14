'use client'

// ============================================
// BLAGAJNA — Glavna komponenta
// Upravljajte izmene in stanje blagajne
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Lock, Unlock, CalendarCheck } from 'lucide-react'
import { useState, memo } from 'react'
import { format } from 'date-fns'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import dynamic from 'next/dynamic'

// Leno-naložene podkomponente
const ActiveShiftView = dynamic(() => import('./cash-register/ActiveShiftView').then(m => m.ActiveShiftView), { ssr: false })
const RecentShiftsList = dynamic(() => import('./cash-register/RecentShiftsList').then(m => m.RecentShiftsList), { ssr: false })
const OpenShiftDialog = dynamic(() => import('./cash-register/OpenShiftDialog').then(m => m.OpenShiftDialog), { ssr: false })
const CloseShiftDialog = dynamic(() => import('./cash-register/CloseShiftDialog').then(m => m.CloseShiftDialog), { ssr: false })
const EodDialog = dynamic(() => import('./cash-register/EodDialog').then(m => m.EodDialog), { ssr: false })

import type { OpenShiftFormType, CloseShiftFormType, EodFormType } from './cash-register/constants'

export const CashRegister = memo(function CashRegister() {
  const queryClient = useQueryClient()
  const [openDialog, setOpenDialog] = useState(false)
  const [closeDialog, setCloseDialog] = useState(false)
  const [eodDialog, setEodDialog] = useState(false)
  const [openForm, setOpenForm] = useState<OpenShiftFormType>({ startingCash: '200', employeeId: '', employeeName: '' })
  const [closeForm, setCloseForm] = useState<CloseShiftFormType>({ closingCash: '', notes: '' })
  const [eodForm, setEodForm] = useState<EodFormType>({ closingCash: '', notes: '' })

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.cashRegister.all,
    queryFn: async () => {
      const res = await authFetch('/api/cash-register')
      if (!res.ok) throw new Error('Napaka pri nalaganju blagajne')
      return res.json()
    },
    refetchInterval: 15000,
  })

  const { data: employees } = useQuery({
    queryKey: queryKeys.employees.all,
    queryFn: async () => {
      const res = await authFetch('/api/employees')
      if (!res.ok) throw new Error('Napaka pri nalaganju zaposlenih')
      return res.json()
    },
  })

  const employeesList = Array.isArray(employees) ? employees : []

  // EOD (Zaključek obratovalnega dneva)
  const [eodDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const { data: eodData, isLoading: eodLoading } = useQuery({
    queryKey: [...queryKeys.endOfDay.all, eodDate],
    queryFn: async () => {
      const res = await authFetch(`/api/reports/eod?date=${eodDate}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju ZOD poročila')
      return res.json()
    },
    enabled: eodDialog,
  })

  const eodCloseMutation = useMutation({
    mutationFn: async ({ closingCash, notes }: { closingCash: number; notes: string }) => {
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
      setEodDialog(false)
      setEodForm({ closingCash: '', notes: '' })
      queryClient.invalidateQueries({ queryKey: queryKeys.cashRegister.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const activeShift = data?.activeShift
  const liveStats = data?.liveStats
  const recentShifts = data?.recentShifts || []

  // Open shift mutation
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
      setOpenDialog(false)
      queryClient.invalidateQueries({ queryKey: queryKeys.cashRegister.all })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Close shift mutation
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
      setCloseDialog(false)
      queryClient.invalidateQueries({ queryKey: queryKeys.cashRegister.all })
    },
    onError: () => toast.error('Napaka pri zapiranju izmene'),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  const handleEodSubmit = () => {
    const startingCash = eodData?.activeShift?.startingCash ?? 0
    const totalRevenue = eodData?.summary?.totalRevenue ?? 0
    const closingCash = eodForm.closingCash ? parseFloat(eodForm.closingCash) : startingCash + totalRevenue
    const notes = eodForm.notes
    eodCloseMutation.mutate({ closingCash: isNaN(closingCash) ? 0 : closingCash, notes })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Blagajna</h2>
          <p className="text-muted-foreground">Upravljajte izmene in stanje blagajne</p>
        </div>
        {activeShift ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEodDialog(true)}>
              <CalendarCheck className="h-4 w-4 mr-2" />
              Zaključi dan
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setCloseForm({ closingCash: String(liveStats?.expectedCash || activeShift.startingCash), notes: '' })
                setCloseDialog(true)
              }}
            >
              <Lock className="h-4 w-4 mr-2" />
              Zapri izmeno
            </Button>
          </div>
        ) : (
          <Button onClick={() => setOpenDialog(true)}>
            <Unlock className="h-4 w-4 mr-2" />
            Odpri izmeno
          </Button>
        )}
      </div>

      {/* Active Shift Info */}
      {activeShift ? (
        <ActiveShiftView activeShift={activeShift} liveStats={liveStats} />
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold mb-2">Blagajna ni odprta</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Za začetek prodaje morate odpreti novo izmeno in vnesti začetno stanje gotovine.
            </p>
            <Button onClick={() => setOpenDialog(true)}>
              <Unlock className="h-4 w-4 mr-2" />
              Odpri izmeno
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Closed Shifts */}
      <RecentShiftsList shifts={recentShifts} />

      {/* Open Shift Dialog */}
      <OpenShiftDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        form={openForm}
        onFormChange={setOpenForm}
        employees={employeesList}
        onSubmit={openShiftMutation.mutate}
        isPending={openShiftMutation.isPending}
      />

      {/* Close Shift Dialog */}
      <CloseShiftDialog
        open={closeDialog}
        onOpenChange={setCloseDialog}
        form={closeForm}
        onFormChange={setCloseForm}
        liveStats={liveStats}
        onSubmit={() => {
          if (activeShift) closeShiftMutation.mutate({ id: activeShift.id, form: closeForm })
        }}
        isPending={closeShiftMutation.isPending}
      />

      {/* ZOD Dialog */}
      <EodDialog
        open={eodDialog}
        onOpenChange={setEodDialog}
        eodData={eodData}
        eodLoading={eodLoading}
        form={eodForm}
        onFormChange={setEodForm}
        onSubmit={handleEodSubmit}
        isPending={eodCloseMutation.isPending}
      />
    </div>
  )
})
