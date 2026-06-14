'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CalendarDays, Clock } from 'lucide-react'
import { memo } from 'react'
import dynamic from 'next/dynamic'
import { useShiftManager } from './shift/useShiftManager'

// Lazy-loaded podkomponente
const ShiftSummaryCards = dynamic(() => import('./shift/ShiftSummaryCards').then(m => ({ default: m.ShiftSummaryCards })), { ssr: false })
const ShiftsTab = dynamic(() => import('./shift/ShiftsTab').then(m => ({ default: m.ShiftsTab })), { ssr: false })
const TimeTab = dynamic(() => import('./shift/TimeTab').then(m => ({ default: m.TimeTab })), { ssr: false })
const ShiftDialog = dynamic(() => import('./shift/ShiftDialog').then(m => ({ default: m.ShiftDialog })), { ssr: false })
const DeleteShiftDialog = dynamic(() => import('./shift/DeleteShiftDialog').then(m => ({ default: m.DeleteShiftDialog })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export const ShiftManager = memo(function ShiftManager() {
  const {
    shiftDialogOpen,
    editingShift,
    shiftForm, setShiftForm,
    deleteShiftDialogOpen, setDeleteShiftDialogOpen,
    clockInEmployeeId, setClockInEmployeeId,
    clockInJobId, setClockInJobId,
    employeesList, jobs,
    allShifts, shiftsLoading,
    activeEntries, completedEntries, entriesLoading,
    scheduledCount, inProgressCount, completedCount, totalHoursToday,
    createShiftMutation, updateShiftMutation, deleteShiftMutation,
    clockInMutation,
    openCreateShift, openEditShift, handleShiftSubmit,
    startShift, completeShift, markAbsent,
    handleClockIn, handleClockOut,
    handleShiftDialogOpenChange,
    handleDeleteShift, handleDeleteConfirm,
  } = useShiftManager()

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar">
      {/* Glava */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          Izmene in ure
        </h2>
        <p className="text-sm text-muted-foreground">Upravljanje izmen, prijava/odjava ur in sledenje prisotnosti</p>
      </div>

      {/* Povzetek */}
      <ShiftSummaryCards
        scheduledCount={scheduledCount}
        inProgressCount={inProgressCount}
        completedCount={completedCount}
        totalHoursToday={totalHoursToday}
      />

      {/* Zavihki */}
      <Tabs defaultValue="shifts">
        <TabsList>
          <TabsTrigger value="shifts"><CalendarDays className="h-4 w-4 mr-1.5" />Izmene</TabsTrigger>
          <TabsTrigger value="time"><Clock className="h-4 w-4 mr-1.5" />Ure</TabsTrigger>
        </TabsList>

        <TabsContent value="shifts" className="space-y-4">
          <ShiftsTab
            shifts={allShifts}
            shiftsLoading={shiftsLoading}
            openCreateShift={openCreateShift}
            openEditShift={openEditShift}
            startShift={startShift}
            completeShift={completeShift}
            markAbsent={markAbsent}
            onDeleteShift={handleDeleteShift}
          />
        </TabsContent>

        <TabsContent value="time" className="space-y-4">
          <TimeTab
            employeesList={employeesList}
            jobs={jobs}
            clockInEmployeeId={clockInEmployeeId}
            clockInJobId={clockInJobId}
            setClockInEmployeeId={setClockInEmployeeId}
            setClockInJobId={setClockInJobId}
            handleClockIn={handleClockIn}
            handleClockOut={handleClockOut}
            activeEntries={activeEntries}
            completedEntries={completedEntries}
            entriesLoading={entriesLoading}
            clockInPending={clockInMutation.isPending}
          />
        </TabsContent>
      </Tabs>

      {/* Dijalog za izmeno */}
      <ShiftDialog
        open={shiftDialogOpen}
        onOpenChange={handleShiftDialogOpenChange}
        editingShift={editingShift}
        shiftForm={shiftForm}
        onShiftFormChange={setShiftForm}
        employeesList={employeesList}
        jobs={jobs}
        onSubmit={handleShiftSubmit}
        createPending={createShiftMutation.isPending}
        updatePending={updateShiftMutation.isPending}
      />

      {/* Dijalog za brisanje */}
      <DeleteShiftDialog
        open={deleteShiftDialogOpen}
        onOpenChange={setDeleteShiftDialogOpen}
        onConfirm={handleDeleteConfirm}
        isPending={deleteShiftMutation.isPending}
      />
    </div>
  )
})
