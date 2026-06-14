'use client'

import { Button } from '@/components/ui/button'
import { Plus, ShieldCheck } from 'lucide-react'
import { memo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useHaccpManager } from './haccp/useHaccpManager'

// Lazy-loaded sub-komponente
const HaccpSummaryCards = dynamic(() => import('./haccp/HaccpSummaryCards').then((m) => m.HaccpSummaryCards), { ssr: false })
const HaccpEntryDialog = dynamic(() => import('./haccp/HaccpEntryDialog').then((m) => m.HaccpEntryDialog), { ssr: false })
const HaccpDeleteDialog = dynamic(() => import('./haccp/HaccpDeleteDialog').then((m) => m.HaccpDeleteDialog), { ssr: false })
const HaccpAlerts = dynamic(() => import('./haccp/HaccpAlerts').then((m) => m.HaccpAlerts), { ssr: false })
const HaccpFilters = dynamic(() => import('./haccp/HaccpFilters').then((m) => m.HaccpFilters), { ssr: false })
const HaccpLoadingSkeleton = dynamic(() => import('./haccp/HaccpLoadingSkeleton').then((m) => m.HaccpLoadingSkeleton), { ssr: false })
const HaccpEntryList = dynamic(() => import('./haccp/HaccpEntryList').then((m) => m.HaccpEntryList), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export const HaccpManager = memo(function HaccpManager() {
  const {
    activeTab,
    setActiveTab,
    search,
    setSearch,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    showFilters,
    setShowFilters,
    dialogOpen,
    editingEntry,
    formData,
    setFormData,
    deleteDialogOpen,
    deleteTarget,
    expandedEntry,
    setExpandedEntry,
    isLoading,
    allEntries,
    filteredEntries,
    todayEntries,
    warningCount,
    criticalCount,
    lastEntryTime,
    hasActiveFilters,
    isCreatePending,
    isUpdatePending,
    isDeletePending,
    openCreate,
    openEdit,
    handleSubmit,
    confirmDelete,
    resetFilters,
    handleDialogOpenChange,
    handleDeleteConfirm,
    setDeleteDialogOpen,
  } = useHaccpManager()

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedEntry(expandedEntry === id ? null : id)
  }, [expandedEntry, setExpandedEntry])

  // Nalaganje
  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">HACCP Dnevnik</h2>
            <p className="text-muted-foreground">Nalaganje...</p>
          </div>
        </div>
        <HaccpLoadingSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Glava */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            HACCP Dnevnik
          </h2>
          <p className="text-muted-foreground">Vodenje evidenčnih listov živilske varnosti</p>
        </div>
        <Button onClick={() => openCreate()}>
          <Plus className="h-4 w-4 mr-2" />
          Nov vnos
        </Button>
      </div>

      {/* Povzetek */}
      <HaccpSummaryCards
        todayCount={todayEntries.length}
        warningCount={warningCount}
        criticalCount={criticalCount}
        lastEntryTime={lastEntryTime}
      />

      {/* Opozorila */}
      <HaccpAlerts
        allEntries={allEntries}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Filtri */}
      <HaccpFilters
        search={search}
        onSearchChange={setSearch}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        showFilters={showFilters}
        onShowFiltersChange={setShowFilters}
        hasActiveFilters={hasActiveFilters}
        onReset={resetFilters}
      />

      {/* Zavihki po kategorijah */}
      <HaccpEntryList
        activeTab={activeTab}
        onTabChange={setActiveTab}
        filteredEntries={filteredEntries}
        allEntriesCount={allEntries.length}
        expandedEntry={expandedEntry}
        onToggleExpand={handleToggleExpand}
        onEdit={openEdit}
        onDelete={confirmDelete}
        onCreate={openCreate}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />

      {/* Dijalog za vnos/urejanje */}
      <HaccpEntryDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        editingEntry={editingEntry}
        formData={formData}
        setFormData={setFormData}
        onSave={handleSubmit}
        isCreatePending={isCreatePending}
        isUpdatePending={isUpdatePending}
      />

      {/* Dijalog za brisanje */}
      <HaccpDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        deleteTarget={deleteTarget}
        onConfirm={handleDeleteConfirm}
        isPending={isDeletePending}
      />
    </div>
  )
})
