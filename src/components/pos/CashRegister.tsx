'use client'

// ============================================
// BLAGAJNA — Glavna komponenta
// Vse query-je/mutacije/obdelovalce hrani tukaj,
// podkomponente so lazy-loaded iz cash-register/
// ============================================

import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Lock, Unlock, CalendarCheck } from 'lucide-react'
import { useState, memo, useCallback } from 'react'
import { format } from 'date-fns'
import dynamic from 'next/dynamic'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { OpenShiftFormType, CloseShiftFormType, EodFormType } from './cash-register/constants'
import { useCashRegisterMutations } from './cash-register/useCashRegisterMutations'
import { CashRegisterLoading, NoActiveShiftCard } from './cash-register/CashRegisterLoading'

// Lazy-loaded podkomponente
const ActiveShiftView = dynamic(() => import('./cash-register/ActiveShiftView').then(m => ({ default: m.ActiveShiftView })), { ssr: false })
const RecentShiftsList = dynamic(() => import('./cash-register/RecentShiftsList').then(m => ({ default: m.RecentShiftsList })), { ssr: false })
const OpenShiftDialog = dynamic(() => import('./cash-register/OpenShiftDialog').then(m => ({ default: m.OpenShiftDialog })), { ssr: false })
const CloseShiftDialog = dynamic(() => import('./cash-register/CloseShiftDialog').then(m => ({ default: m.CloseShiftDialog })), { ssr: false })
const EodDialog = dynamic(() => import('./cash-register/EodDialog').then(m => ({ default: m.EodDialog })), { ssr: false })

export const CashRegister = memo(function CashRegister() {
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

  const activeShift = data?.activeShift
  const liveStats = data?.liveStats
  const recentShifts = data?.recentShifts || []

  const { openShiftMutation, closeShiftMutation, eodCloseMutation } = useCashRegisterMutations({
    onCloseOpenDialog: () => setOpenDialog(false),
    onCloseCloseDialog: () => setCloseDialog(false),
    onCloseEodDialog: () => setEodDialog(false),
    onResetEodForm: () => setEodForm({ closingCash: '', notes: '' }),
  })

  const handleOpenShiftSubmit = useCallback((form: OpenShiftFormType) => {
    openShiftMutation.mutate(form)
  }, [openShiftMutation])

  const handleCloseShiftSubmit = useCallback(() => {
    if (activeShift) closeShiftMutation.mutate({ id: activeShift.id, form: closeForm })
  }, [activeShift, closeForm, closeShiftMutation])

  const handleEodSubmit = useCallback(() => {
    const startingCash = eodData?.activeShift?.startingCash ?? 0
    const totalRevenue = eodData?.summary?.totalRevenue ?? 0
    const closingCash = eodForm.closingCash ? parseFloat(eodForm.closingCash) : startingCash + totalRevenue
    const notes = eodForm.notes
    eodCloseMutation.mutate({ closingCash: isNaN(closingCash) ? 0 : closingCash, notes, eodDate })
  }, [eodData, eodForm, eodCloseMutation, eodDate])

  if (isLoading) {
    return <CashRegisterLoading />
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
            <Button variant="outline" onClick={() => setEodDialog(true)} aria-label="Zaključi dan">
              <CalendarCheck className="h-4 w-4 mr-2" />Zaključi dan
            </Button>
            <Button variant="destructive" onClick={() => { setCloseForm({ closingCash: String(liveStats?.expectedCash || activeShift.startingCash), notes: '' }); setCloseDialog(true) }} aria-label="Zapri izmeno">
              <Lock className="h-4 w-4 mr-2" />Zapri izmeno
            </Button>
          </div>
        ) : (
          <Button onClick={() => setOpenDialog(true)} aria-label="Odpri izmeno">
            <Unlock className="h-4 w-4 mr-2" />Odpri izmeno
          </Button>
        )}
      </div>

      {activeShift ? (
        <ActiveShiftView activeShift={activeShift} liveStats={liveStats} />
      ) : (
        <NoActiveShiftCard onOpenShift={() => setOpenDialog(true)} />
      )}

      <RecentShiftsList shifts={recentShifts} />
      <OpenShiftDialog open={openDialog} onOpenChange={setOpenDialog} form={openForm} onFormChange={setOpenForm} employees={employeesList} onSubmit={handleOpenShiftSubmit} isPending={openShiftMutation.isPending} />
      <CloseShiftDialog open={closeDialog} onOpenChange={setCloseDialog} form={closeForm} onFormChange={setCloseForm} liveStats={liveStats} onSubmit={handleCloseShiftSubmit} isPending={closeShiftMutation.isPending} />
      <EodDialog open={eodDialog} onOpenChange={setEodDialog} eodData={eodData} eodLoading={eodLoading} form={eodForm} onFormChange={setEodForm} onSubmit={handleEodSubmit} isPending={eodCloseMutation.isPending} />
    </div>
  )
})
