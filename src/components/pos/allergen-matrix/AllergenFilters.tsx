'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Search } from 'lucide-react'
import type { AllergenFiltersProps } from './constants'

// ============================================
// FILTRI ZA ALERGENI MATRIKO
// ============================================

export const AllergenFilters = memo(function AllergenFilters({
  searchQuery,
  onSearchQueryChange,
  categoryFilter,
  onCategoryFilterChange,
  categories,
  showOnlyWithAllergens,
  onShowOnlyWithAllergensChange,
}: AllergenFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id="allergen-search"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Išči artikel..."
          className="pl-9"
          aria-label="Išči artikel"
        />
      </div>
      <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
        <SelectTrigger className="w-48" aria-label="Filtriraj po kategoriji">
          <SelectValue placeholder="Kategorija" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Vse kategorije</SelectItem>
          {categories.map(cat => (
            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <Switch
          id="allergen-filter-switch"
          checked={showOnlyWithAllergens}
          onCheckedChange={onShowOnlyWithAllergensChange}
          aria-label="Prikaži samo artikle z alergeni"
        />
        <label htmlFor="allergen-filter-switch" className="text-xs text-muted-foreground">Samo z alergeni</label>
      </div>
    </div>
  )
})
