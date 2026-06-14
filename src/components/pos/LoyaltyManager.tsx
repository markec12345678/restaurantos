'use client'

import { Button } from '@/components/ui/button'
import { Plus, Crown } from 'lucide-react'
import { memo } from 'react'
import dynamic from 'next/dynamic'
import { useLoyaltyState } from './loyalty/useLoyaltyState'

// Lazy-loaded podkomponente
const LoyaltySummaryCards = dynamic(() => import('./loyalty/LoyaltySummaryCards').then(m => ({ default: m.LoyaltySummaryCards })), { ssr: false })
const LoyaltyFilters = dynamic(() => import('./loyalty/LoyaltyFilters').then(m => ({ default: m.LoyaltyFilters })), { ssr: false })
const LoyaltyAccountTable = dynamic(() => import('./loyalty/LoyaltyAccountTable').then(m => ({ default: m.LoyaltyAccountTable })), { ssr: false })
const LoyaltyFormDialog = dynamic(() => import('./loyalty/LoyaltyFormDialog').then(m => ({ default: m.LoyaltyFormDialog })), { ssr: false })
const LoyaltyAdjustPointsDialog = dynamic(() => import('./loyalty/LoyaltyAdjustPointsDialog').then(m => ({ default: m.LoyaltyAdjustPointsDialog })), { ssr: false })
const LoyaltyHistoryDialog = dynamic(() => import('./loyalty/LoyaltyHistoryDialog').then(m => ({ default: m.LoyaltyHistoryDialog })), { ssr: false })
const LoyaltyDeleteDialog = dynamic(() => import('./loyalty/LoyaltyDeleteDialog').then(m => ({ default: m.LoyaltyDeleteDialog })), { ssr: false })
const LoyaltyLoadingSkeleton = dynamic(() => import('./loyalty/LoyaltyLoadingSkeleton').then(m => ({ default: m.LoyaltyLoadingSkeleton })), { ssr: false })

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export const LoyaltyManager = memo(function LoyaltyManager() {
  const s = useLoyaltyState()

  // Nalaganje
  if (s.isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Zvestobni program</h2>
            <p className="text-muted-foreground">Nalaganje...</p>
          </div>
        </div>
        <LoyaltyLoadingSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Glava */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Crown className="h-6 w-6 text-primary" />
            Zvestobni program
          </h2>
          <p className="text-muted-foreground">Upravljanje zvestobnih računov in točk</p>
        </div>
        <Button onClick={s.openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj račun
        </Button>
      </div>

      {/* Povzetek */}
      <LoyaltySummaryCards
        totalAccounts={s.allAccounts.length}
        activeAccounts={s.activeAccounts.length}
        totalPointsIssued={s.totalPointsIssued}
        totalPointsRedeemed={s.totalPointsRedeemed}
      />

      {/* Filtri */}
      <LoyaltyFilters
        search={s.search}
        tierFilter={s.tierFilter}
        showInactive={s.showInactive}
        onSearchChange={s.handleSearchChange}
        onTierFilterChange={s.setTierFilter}
        onShowInactiveChange={s.setShowInactive}
        onResetFilters={s.resetFilters}
      />

      {/* Tabela računov */}
      <LoyaltyAccountTable
        accounts={s.filteredAccounts}
        totalAccounts={s.allAccounts.length}
        tierFilter={s.tierFilter}
        onOpenAdjust={s.openAdjust}
        onOpenHistory={s.openHistory}
        onOpenEdit={s.openEdit}
        onConfirmDelete={s.confirmDelete}
        onOpenCreate={s.openCreate}
        search={s.search}
      />

      {/* Dijalog za vnos/urejanje */}
      <LoyaltyFormDialog
        open={s.dialogOpen}
        editingAccount={s.editingAccount}
        formData={s.formData}
        isCreatePending={s.isCreatePending}
        isUpdatePending={s.isUpdatePending}
        onOpenChange={s.handleFormDialogOpenChange}
        onFormDataChange={s.setFormData}
        onSubmit={s.handleSubmit}
        onCancel={s.handleFormDialogCancel}
      />

      {/* Dijalog za prilagajanje točk */}
      <LoyaltyAdjustPointsDialog
        open={s.adjustDialogOpen}
        adjustAccount={s.adjustAccount}
        adjustData={s.adjustData}
        isPending={s.isAdjustPending}
        onOpenChange={s.setAdjustDialogOpen}
        onAdjustDataChange={s.setAdjustData}
        onSubmit={s.handleAdjust}
        onCancel={s.handleAdjustDialogClose}
      />

      {/* Dijalog za zgodovino transakcij */}
      <LoyaltyHistoryDialog
        open={s.historyDialogOpen}
        historyAccount={s.historyAccount}
        accountDetail={s.accountDetail}
        isLoadingDetail={s.isLoadingDetail}
        onOpenChange={s.setHistoryDialogOpen}
      />

      {/* Dijalog za brisanje */}
      <LoyaltyDeleteDialog
        open={s.deleteDialogOpen}
        deleteTarget={s.deleteTarget}
        isPending={s.isDeletePending}
        onOpenChange={s.handleDeleteDialogOpenChange}
        onConfirm={s.handleConfirmDeleteAccount}
      />
    </div>
  )
})
