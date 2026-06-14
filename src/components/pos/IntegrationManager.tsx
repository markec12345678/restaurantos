'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus, Plug } from 'lucide-react'
import { memo } from 'react'
import dynamic from 'next/dynamic'
import { useIntegrationManager } from './integration/useIntegrationManager'

// Lazy-loaded pod-komponente
const StatsCards = dynamic(() => import('./integration/StatsCards').then((m) => m.StatsCards), { ssr: false })
const IntegrationTable = dynamic(() => import('./integration/IntegrationTable').then((m) => m.IntegrationTable), { ssr: false })
const IntegrationDialog = dynamic(() => import('./integration/IntegrationDialog').then((m) => m.IntegrationDialog), { ssr: false })
const DeleteDialog = dynamic(() => import('./integration/DeleteDialog').then((m) => m.DeleteDialog), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export const IntegrationManager = memo(function IntegrationManager() {
  const {
    search,
    filterType,
    dialogOpen,
    editingItem,
    selectedConnector,
    formData,
    deleteDialogOpen,
    deleteTarget,
    isLoading,
    allIntegrations,
    filteredIntegrations,
    activeCount,
    connectedCount,
    errorCount,
    isCreating,
    isUpdating,
    testPending,
    syncPending,
    setSearch,
    setFilterType,
    setFormData,
    openCreate,
    selectConnector,
    openEdit,
    handleSubmit,
    handleDialogOpenChange,
    handleDeleteTarget,
    handleDeleteConfirm,
    testMutation,
    syncMutation,
    cancelDialog,
    setDeleteDialogOpen,
  } = useIntegrationManager()

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar">
      {/* Glava */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Plug className="h-5 w-5 text-primary" />
            Integracije
          </h2>
          <p className="text-sm text-muted-foreground">Povezave z zunanjimi sistemi: e-Računi, računovodstvo, dostava, CRM</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj integracijo
        </Button>
      </div>

      {/* Povzetek */}
      <StatsCards
        totalCount={allIntegrations.length}
        connectedCount={connectedCount}
        activeCount={activeCount}
        errorCount={errorCount}
      />

      {/* Tabela in filtri */}
      <IntegrationTable
        filteredIntegrations={filteredIntegrations}
        search={search}
        filterType={filterType}
        onSearchChange={setSearch}
        onFilterTypeChange={setFilterType}
        onTest={testMutation}
        onSync={syncMutation}
        onEdit={openEdit}
        onDelete={handleDeleteTarget}
        onAdd={openCreate}
        testPending={testPending}
        syncPending={syncPending}
      />

      {/* Dijalog za vnos/urejanje */}
      <IntegrationDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        editingItem={editingItem}
        selectedConnector={selectedConnector}
        formData={formData}
        onFormDataChange={setFormData}
        onSelectConnector={selectConnector}
        onSubmit={handleSubmit}
        onCancel={cancelDialog}
        isCreating={isCreating}
        isUpdating={isUpdating}
      />

      {/* Dijalog za brisanje */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        deleteTarget={deleteTarget}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
})
