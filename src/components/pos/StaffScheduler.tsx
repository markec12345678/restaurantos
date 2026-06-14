'use client'

import { format, addDays } from 'date-fns'
import { memo } from 'react'
import dynamic from 'next/dynamic'
import { useStaffScheduler } from './scheduler/useStaffScheduler'

// Lazy-loaded podkomponente
const SchedulerHeader = dynamic(() => import('./scheduler/SchedulerHeader').then(m => ({ default: m.SchedulerHeader })), { ssr: false })
const WeekNavigator = dynamic(() => import('./scheduler/WeekNavigator').then(m => ({ default: m.WeekNavigator })), { ssr: false })
const StatsCards = dynamic(() => import('./scheduler/StatsCards').then(m => ({ default: m.StatsCards })), { ssr: false })
const WeekView = dynamic(() => import('./scheduler/WeekView').then(m => ({ default: m.WeekView })), { ssr: false })
const ShiftDialog = dynamic(() => import('./scheduler/ShiftDialog').then(m => ({ default: m.ShiftDialog })), { ssr: false })
const CopyWeekDialog = dynamic(() => import('./scheduler/CopyWeekDialog').then(m => ({ default: m.CopyWeekDialog })), { ssr: false })

// ─── GLAVNA KOMPONENTA ─────────────────────────────────────────
export const StaffScheduler = memo(function StaffScheduler() {
  const {
    weekStart, weekEnd, weekDates,
    dialogOpen,
    editingShift,
    selectedEmployee, setSelectedEmployee,
    copyDialogOpen, setCopyDialogOpen,
    copySourceDate, setCopySourceDate,
    shifts, employees, jobs,
    shiftsByDate, shiftsByEmployee,
    isLoading, stats,
    saveMutation,
    navigateWeek, goToThisWeek,
    openNewShift, handleShiftStatusChange, handleEditShift,
    handleDeleteShift, handleDialogClose,
    handleCopyWeek, handleCopyDialogClose,
  } = useStaffScheduler()

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <SchedulerHeader
        stats={stats}
        filteredShiftsCount={shifts.length}
        onCopyWeek={() => setCopyDialogOpen(true)}
        onNewShift={() => openNewShift()}
      />
      {/* Teden navigacija + filtri */}
      <WeekNavigator
        weekStart={weekStart}
        weekEnd={weekEnd}
        selectedEmployee={selectedEmployee}
        employees={employees}
        onNavigateWeek={navigateWeek}
        onGoToThisWeek={goToThisWeek}
        onEmployeeChange={setSelectedEmployee}
      />
      {/* Statisticne kartice */}
      <StatsCards stats={stats} />
      {/* Tedenski razpored */}
      <WeekView
        weekDates={weekDates}
        shiftsByDate={shiftsByDate}
        shiftsByEmployee={shiftsByEmployee}
        filteredShifts={shifts}
        isLoading={isLoading}
        onAddShift={openNewShift}
        onEditShift={handleEditShift}
        onDeleteShift={handleDeleteShift}
        onStatusChange={handleShiftStatusChange}
      />
      {/* Dialog za novo/uredi izmeno */}
      <ShiftDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        shift={editingShift}
        employees={employees}
        jobs={jobs}
        weekDates={weekDates}
        onSave={saveMutation.mutate}
      />
      {/* Dialog za kopiranje tedna */}
      <CopyWeekDialog
        open={copyDialogOpen}
        onClose={handleCopyDialogClose}
        onOpenChange={setCopyDialogOpen}
        copySourceDate={copySourceDate}
        onCopySourceDateChange={setCopySourceDate}
        defaultSourceDate={format(addDays(weekStart, -7), 'yyyy-MM-dd')}
        onCopy={handleCopyWeek}
      />
    </div>
  )
})
