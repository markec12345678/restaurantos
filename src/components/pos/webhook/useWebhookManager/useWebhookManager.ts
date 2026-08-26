'use client'
// ============================================
// HOOK: Stanje in logika za upravitelja spletnih kljuk
// Izvleče poslovno logiko iz glavne komponente
// ============================================

import type { WebhookItem, FormData } from '../constants'
import { useWebhookState } from './useWebhookState'
import { useWebhookHandlers } from './useWebhookHandlers'

export function useWebhookManager() {
  const state = useWebhookState()
  const handlers = useWebhookHandlers(
    state.formData,
    state.editingItem,
    state.setDialogOpen,
    state.setEditingItem,
    state.setDeleteDialogOpen,
    state.setDeleteTarget,
    state.setFormData,
    state.deleteTarget,
  )

  return {
    // Stanja
    search: state.search,
    showInactive: state.showInactive,
    dialogOpen: state.dialogOpen,
    editingItem: state.editingItem,
    formData: state.formData,
    deleteDialogOpen: state.deleteDialogOpen,
    deleteTarget: state.deleteTarget,
    isLoading: state.isLoading,
    allWebhooks: state.allWebhooks,
    filteredWebhooks: state.filteredWebhooks,
    activeCount: state.activeCount,
    totalEvents: state.totalEvents,
    failedCount: state.failedCount,
    createMutation: handlers.createMutation,
    updateMutation: handlers.updateMutation,
    // Handlerji
    setSearch: state.setSearch,
    setShowInactive: state.setShowInactive,
    setFormData: state.setFormData,
    openCreate: handlers.openCreate,
    openEdit: handlers.openEdit,
    handleSubmit: handlers.handleSubmit,
    toggleEvent: handlers.toggleEvent,
    testWebhook: handlers.testWebhook,
    handleDialogOpenChange: handlers.handleDialogOpenChange,
    handleDeleteTarget: handlers.handleDeleteTarget,
    handleDeleteConfirm: handlers.handleDeleteConfirm,
    setDeleteDialogOpen: state.setDeleteDialogOpen,
  }
}

// Re-export types used by consumers
export type { WebhookItem, FormData }
