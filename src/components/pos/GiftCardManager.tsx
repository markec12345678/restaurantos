'use client'

import { memo } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { useGiftCardManager } from './gift-cards/useGiftCardManager'
import { statusConfig } from './gift-cards/constants'
import { slCount, KARTICA_FORMS } from '@/lib/sl-plural'
import {
  downloadCsv,
  giftCardRegistryCsv,
  giftCardRegistryCsvFilename,
} from '@/lib/csv-export'

// Lazy-loaded podkomponente
const GiftCardLoadingSkeleton = dynamic(() => import('./gift-cards/GiftCardLoadingSkeleton').then(m => ({ default: m.GiftCardLoadingSkeleton })), { ssr: false })
const GiftCardPageHeader = dynamic(() => import('./gift-cards/GiftCardPageHeader').then(m => ({ default: m.GiftCardPageHeader })), { ssr: false })
const GiftCardSummaryCards = dynamic(() => import('./gift-cards/GiftCardSummaryCards').then(m => ({ default: m.GiftCardSummaryCards })), { ssr: false })
const GiftCardTable = dynamic(() => import('./gift-cards/GiftCardTable').then(m => ({ default: m.GiftCardTable })), { ssr: false })
const NewCardDialog = dynamic(() => import('./gift-cards/NewCardDialog').then(m => ({ default: m.NewCardDialog })), { ssr: false })
const EditCardDialog = dynamic(() => import('./gift-cards/EditCardDialog').then(m => ({ default: m.EditCardDialog })), { ssr: false })
const LoadFundsDialog = dynamic(() => import('./gift-cards/LoadFundsDialog').then(m => ({ default: m.LoadFundsDialog })), { ssr: false })
const TransactionHistoryDialog = dynamic(() => import('./gift-cards/TransactionHistoryDialog').then(m => ({ default: m.TransactionHistoryDialog })), { ssr: false })
const DeleteCardDialog = dynamic(() => import('./gift-cards/DeleteCardDialog').then(m => ({ default: m.DeleteCardDialog })), { ssr: false })
// R144-c (epic #115 #31): odpustna obveznost (liability) — lastna sekcija z lastnim
// agregatom GET /api/gift-cards/liability (next/dynamic ssr:false kanon težjih sekcij)
const GiftCardLiabilitySection = dynamic(() => import('./gift-cards/GiftCardLiabilitySection').then(m => ({ default: m.GiftCardLiabilitySection })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export const GiftCardManager = memo(function GiftCardManager() {
  const {
    isLoading,
    search, statusFilter, sortField, sortDir, setSearch, setStatusFilter,
    allCards, filteredCards, summaryStats,
    newCardDialogOpen, setNewCardDialogOpen, newCardForm, setNewCardForm,
    handleCreateCard, isCreatePending,
    editDialogOpen, handleEditDialogOpenChange, editTarget, editForm, setEditForm,
    handleEditSave, isUpdatePending,
    loadDialogOpen, handleLoadDialogOpenChange, loadTarget, loadForm, setLoadForm,
    handleLoad, isLoadPending,
    historyDialogOpen, handleHistoryDialogOpenChange, historyTarget,
    deleteDialogOpen, setDeleteDialogOpen, deleteTarget, handleDeleteConfirm,
    isDeletePending,
    handleSort, openNewCard, openEdit, openLoad, openHistory,
    confirmDelete, suspendCard, reactivateCard,
  } = useGiftCardManager()

  const { totalCards, activeCards, totalBalanceOutstanding, totalLoadedThisMonth } = summaryStats

  // RUNDA 56: izvoz REGISTRA kartic (trenutno filtriran + sortiran seznam —
  // isti, ki ga uporabnik vidi v tabeli). decimalna vejica + podpičje + BOM
  // = dvoklik v slovenskem Excelu takoj uporaben.
  const handleExportRegistry = () => {
    if (filteredCards.length === 0) return
    try {
      const statusLabels = Object.fromEntries(
        Object.entries(statusConfig).map(([k, v]) => [k, v.label]),
      )
      const content = giftCardRegistryCsv(filteredCards, statusLabels)
      const filename = giftCardRegistryCsvFilename()
      if (downloadCsv(filename, content)) {
        toast.success(`Register izvožen — ${slCount(filteredCards.length, KARTICA_FORMS)}`)
      } else {
        toast.error('Prenosa ni bilo mogoče začeti')
      }
    } catch {
      toast.error('Izvoz registra ni uspel — poskusite znova')
    }
  }

  // --- Nalagalni skeleton ---
  if (isLoading) {
    return <GiftCardLoadingSkeleton />
  }

  // --- Glavni render ---
  return (
    <div className="space-y-6 p-6">
      {/* Glava */}
      <GiftCardPageHeader
        onOpenNewCard={openNewCard}
        onExportRegistry={handleExportRegistry}
        exportRegistryDisabled={filteredCards.length === 0}
      />

      {/* Povzetek */}
      <GiftCardSummaryCards
        totalCards={totalCards}
        activeCards={activeCards}
        totalBalanceOutstanding={totalBalanceOutstanding}
        totalLoadedThisMonth={totalLoadedThisMonth}
      />

      {/* Filtri + Tabela kartic */}
      <GiftCardTable
        allCards={allCards}
        filteredCards={filteredCards}
        search={search}
        statusFilter={statusFilter}
        sortField={sortField}
        sortDir={sortDir}
        onSearchChange={setSearch}
        onStatusFilterChange={setStatusFilter}
        onSort={handleSort}
        onOpenNewCard={openNewCard}
        onOpenHistory={openHistory}
        onOpenLoad={openLoad}
        onOpenEdit={openEdit}
        onConfirmDelete={confirmDelete}
        onSuspendCard={suspendCard}
        onReactivateCard={reactivateCard}
      />

      {/* R144-c: Odpustna obveznost — računovodski pregled POD registrom kartic.
          Izbira mesta: zgornji povzetek (GiftCardSummaryCards) ostane glavni
          operativni overview (iz izrisanih kartic), ta sekcija je strežniško-
          avtoritativno poročilo (view_reports, scope, expiring/byLocation) —
          poročni blok pod seznamom, brez dveh sosednjih KPI zidov. Mutacije
          invalidirajo ['gift-cards'] → tudi ['gift-cards','liability']. */}
      <GiftCardLiabilitySection />

      {/* Dijalog za novo kartico */}
      <NewCardDialog
        open={newCardDialogOpen}
        onOpenChange={setNewCardDialogOpen}
        form={newCardForm}
        onFormChange={setNewCardForm}
        onSubmit={handleCreateCard}
        isPending={isCreatePending}
      />

      {/* Dijalog za urejanje kartice */}
      <EditCardDialog
        open={editDialogOpen}
        onOpenChange={handleEditDialogOpenChange}
        target={editTarget}
        form={editForm}
        onFormChange={setEditForm}
        onSubmit={handleEditSave}
        isPending={isUpdatePending}
      />

      {/* Dijalog za nalaganje sredstev */}
      <LoadFundsDialog
        open={loadDialogOpen}
        onOpenChange={handleLoadDialogOpenChange}
        target={loadTarget}
        form={loadForm}
        onFormChange={setLoadForm}
        onSubmit={handleLoad}
        isPending={isLoadPending}
      />

      {/* Dijalog za zgodovino transakcij */}
      <TransactionHistoryDialog
        open={historyDialogOpen}
        onOpenChange={handleHistoryDialogOpenChange}
        target={historyTarget}
      />

      {/* Dijalog za brisanje */}
      <DeleteCardDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        target={deleteTarget}
        onConfirm={handleDeleteConfirm}
        isPending={isDeletePending}
      />
    </div>
  )
})
