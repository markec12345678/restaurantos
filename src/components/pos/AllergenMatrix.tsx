'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Alergeni matrika (EU 1169/2011 standard)
// ═══════════════════════════════════════════════════════════════

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import { ShieldAlert } from 'lucide-react'
import { memo } from 'react'
import { useAllergenMatrixState } from './allergen-matrix/useAllergenMatrixState'

// Lazy-loaded pod-komponenti (ssr: false)
const StatsCards = dynamic(() => import('./allergen-matrix/StatsCards').then(m => ({ default: m.StatsCards })), { ssr: false })
const AllergenFrequency = dynamic(() => import('./allergen-matrix/AllergenFrequency').then(m => ({ default: m.AllergenFrequency })), { ssr: false })
const AllergenFilters = dynamic(() => import('./allergen-matrix/AllergenFilters').then(m => ({ default: m.AllergenFilters })), { ssr: false })
const AllergenTable = dynamic(() => import('./allergen-matrix/AllergenTable').then(m => ({ default: m.AllergenTable })), { ssr: false })
const EuDisclaimer = dynamic(() => import('./allergen-matrix/EuDisclaimer').then(m => ({ default: m.EuDisclaimer })), { ssr: false })
const EditAllergenDialog = dynamic(() => import('./allergen-matrix/EditAllergenDialog').then(m => ({ default: m.EditAllergenDialog })), { ssr: false })

export const AllergenMatrix = memo(function AllergenMatrix() {
  const state = useAllergenMatrixState()

  if (state.isLoading) {
    return (
      <div className="space-y-6 p-1">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((__, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6 overflow-y-auto h-full p-1 custom-scrollbar">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-red-500" /> Matrika alergenov
        </h2>
        <p className="text-sm text-muted-foreground">EU Uredba 1169/2011 — Obvezno označevanje 14 alergenov v živilih</p>
      </div>

      <StatsCards totalItems={state.totalItems} itemsWithAllergens={state.itemsWithAllergens} itemsWithoutAllergens={state.itemsWithoutAllergens} topAllergen={state.allergenCounts[0]} />
      <AllergenFrequency allergenCounts={state.allergenCounts} totalItems={state.totalItems} />
      <AllergenFilters searchQuery={state.searchQuery} onSearchQueryChange={state.setSearchQuery} categoryFilter={state.categoryFilter} onCategoryFilterChange={state.setCategoryFilter} categories={state.categories} showOnlyWithAllergens={state.showOnlyWithAllergens} onShowOnlyWithAllergensChange={state.setShowOnlyWithAllergens} />
      <AllergenTable filteredItems={state.filteredItems} sortField={state.sortField} sortDir={state.sortDir} onSortFieldChange={state.setSortField} onSortDirToggle={state.handleSortDirToggle} onEditItem={state.handleEditItem} />
      <EuDisclaimer />

      <EditAllergenDialog open={!!state.editItem} editItem={state.editItem} editAllergens={state.editAllergens} onOpenChange={state.handleDialogOpenChange} onEditAllergensChange={state.setEditAllergens} onSave={state.handleSave} isPending={state.isPending} />
    </div>
  )
})
