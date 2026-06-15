'use client'

import { useGiftCardDialogs } from '../useGiftCardDialogs'
import { useGiftCardMutations } from '../useGiftCardMutations'
import { useGiftCardMutationHandlers } from '../useGiftCardMutationHandlers'
import { useGiftCardFilters } from './useGiftCardFilters'
import { useGiftCardQueries } from './useGiftCardQueries'

// ============================================
// HOOK: Upravljanje darilnih kartic
// Združuje poizvedbe, filtre, mutacije in dialog handlerje
// ============================================

export function useGiftCardManager() {
  // --- Filtri ---
  const filters = useGiftCardFilters()

  // ============================================
  // DIALOG STATE (iz useGiftCardDialogs)
  // ============================================

  const dlg = useGiftCardDialogs()

  // ============================================
  // QUERIES
  // ============================================

  const queries = useGiftCardQueries({
    statusFilter: filters.statusFilter,
    search: filters.search,
    sortField: filters.sortField,
    sortDir: filters.sortDir,
  })

  // ============================================
  // MUTATIONS + HANDLERJI
  // ============================================

  const mutations = useGiftCardMutations({
    allCards: queries.allCards,
    setNewCardDialogOpen: dlg.setNewCardDialogOpen,
    setEditDialogOpen: dlg.setEditDialogOpen,
    setEditTarget: dlg.setEditTarget,
    setLoadDialogOpen: dlg.setLoadDialogOpen,
    setLoadTarget: dlg.setLoadTarget,
    setDeleteDialogOpen: dlg.setDeleteDialogOpen,
    setDeleteTarget: dlg.setDeleteTarget,
  })

  const handlers = useGiftCardMutationHandlers(dlg, {
    createMutate: mutations.createMutation.mutate,
    updateMutate: mutations.updateMutation.mutate,
    loadMutate: mutations.loadMutation.mutate,
    deleteMutate: mutations.deleteMutation.mutate,
  })

  return {
    // Nalaganje
    isLoading: queries.isLoading,

    // Filtri
    search: filters.search,
    statusFilter: filters.statusFilter,
    sortField: filters.sortField,
    sortDir: filters.sortDir,
    setSearch: filters.setSearch,
    setStatusFilter: filters.setStatusFilter,

    // Izračuni
    allCards: queries.allCards,
    filteredCards: queries.filteredCards,
    summaryStats: queries.summaryStats,

    // Dijalog za novo kartico
    newCardDialogOpen: dlg.newCardDialogOpen,
    setNewCardDialogOpen: dlg.setNewCardDialogOpen,
    newCardForm: dlg.newCardForm,
    setNewCardForm: dlg.setNewCardForm,
    handleCreateCard: handlers.handleCreateCard,
    isCreatePending: mutations.createMutation.isPending,

    // Dijalog za urejanje
    editDialogOpen: dlg.editDialogOpen,
    handleEditDialogOpenChange: dlg.handleEditDialogOpenChange,
    editTarget: dlg.editTarget,
    editForm: dlg.editForm,
    setEditForm: dlg.setEditForm,
    openEdit: dlg.openEdit,
    handleEditSave: handlers.handleEditSave,
    isUpdatePending: mutations.updateMutation.isPending,

    // Dijalog za nalaganje
    loadDialogOpen: dlg.loadDialogOpen,
    handleLoadDialogOpenChange: dlg.handleLoadDialogOpenChange,
    loadTarget: dlg.loadTarget,
    loadForm: dlg.loadForm,
    setLoadForm: dlg.setLoadForm,
    openLoad: dlg.openLoad,
    handleLoad: handlers.handleLoad,
    isLoadPending: mutations.loadMutation.isPending,

    // Dijalog za zgodovino
    historyDialogOpen: dlg.historyDialogOpen,
    handleHistoryDialogOpenChange: dlg.handleHistoryDialogOpenChange,
    historyTarget: dlg.historyTarget,
    openHistory: dlg.openHistory,

    // Dijalog za brisanje
    deleteDialogOpen: dlg.deleteDialogOpen,
    setDeleteDialogOpen: dlg.setDeleteDialogOpen,
    deleteTarget: dlg.deleteTarget,
    confirmDelete: dlg.confirmDelete,
    handleDeleteConfirm: handlers.handleDeleteConfirm,
    isDeletePending: mutations.deleteMutation.isPending,

    // Handlerji za tabelo
    handleSort: filters.handleSort,
    openNewCard: dlg.openNewCard,
    suspendCard: handlers.suspendCard,
    reactivateCard: handlers.reactivateCard,
  }
}
