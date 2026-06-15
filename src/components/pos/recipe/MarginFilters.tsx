'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search } from 'lucide-react'

interface MarginFiltersProps {
  search: string
  onSearchChange: (_value: string) => void
  filterMenu: string
  onFilterMenuChange: (_value: string) => void
}

export const MarginFilters = memo(function MarginFilters({
  search,
  onSearchChange,
  filterMenu,
  onFilterMenuChange,
}: MarginFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="relative flex-1 min-w-48 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Išči artikle..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-9"
          aria-label="Išči artikle"
        />
      </div>
      <Select value={filterMenu} onValueChange={onFilterMenuChange}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Vse kategorije</SelectItem>
          <SelectItem value="Hrana">Hrana</SelectItem>
          <SelectItem value="Pijača">Pijača</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
})
