'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus, Webhook } from 'lucide-react'
import { memo } from 'react'
import dynamic from 'next/dynamic'
import { useWebhookManager } from './webhook/useWebhookManager'

// Lazy-loaded pod-komponente
const StatsCards = dynamic(() => import('./webhook/StatsCards').then(m => ({ default: m.StatsCards })), { ssr: false })
const WebhookTable = dynamic(() => import('./webhook/WebhookTable').then(m => ({ default: m.WebhookTable })), { ssr: false })
const WebhookDialog = dynamic(() => import('./webhook/WebhookDialog').then(m => ({ default: m.WebhookDialog })), { ssr: false })
const DeleteDialog = dynamic(() => import('./webhook/DeleteDialog').then(m => ({ default: m.DeleteDialog })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export const WebhookManager = memo(function WebhookManager() {
  const {
    search,
    showInactive,
    dialogOpen,
    editingItem,
    formData,
    deleteDialogOpen,
    deleteTarget,
    isLoading,
    allWebhooks,
    filteredWebhooks,
    activeCount,
    totalEvents,
    failedCount,
    createMutation,
    updateMutation,
    setSearch,
    setShowInactive,
    setFormData,
    openCreate,
    openEdit,
    handleSubmit,
    toggleEvent,
    testWebhook,
    handleDialogOpenChange,
    handleDeleteTarget,
    handleDeleteConfirm,
    setDeleteDialogOpen,
  } = useWebhookManager()

  // ============================================
  // RENDER
  // ============================================

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
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
            <Webhook className="h-5 w-5 text-primary" />
            Spletne kljuke
          </h2>
          <p className="text-sm text-muted-foreground">Upravljanje webhook integracij za obvestila v realnem času</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj webhook
        </Button>
      </div>

      {/* Povzetek */}
      <StatsCards
        totalCount={allWebhooks.length}
        activeCount={activeCount}
        totalEvents={totalEvents}
        failedCount={failedCount}
      />

      {/* Filtri in tabela */}
      <WebhookTable
        filteredWebhooks={filteredWebhooks}
        search={search}
        showInactive={showInactive}
        onSearchChange={setSearch}
        onShowInactiveChange={setShowInactive}
        onTest={testWebhook}
        onEdit={openEdit}
        onDelete={handleDeleteTarget}
        onAdd={openCreate}
      />

      {/* Dijalog za vnos/urejanje */}
      <WebhookDialog
        open={dialogOpen}
        editingItem={editingItem}
        formData={formData}
        onOpenChange={handleDialogOpenChange}
        onFormDataChange={setFormData}
        onSubmit={handleSubmit}
        onToggleEvent={toggleEvent}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      {/* Dijalog za brisanje */}
      <DeleteDialog
        open={deleteDialogOpen}
        deleteTarget={deleteTarget}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
})
