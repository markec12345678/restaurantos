'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Plus } from 'lucide-react'

// --- Props ---

interface GiftCardFiltersProps {
  search: string
  statusFilter: string
  onSearchChange: (_value: string) => void
  onStatusFilterChange: (_value: string) => void
  onOpenNewCard: () => void
}

// --- Komponenta ---

export const GiftCardFilters = memo(function GiftCardFilters({
  search,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
  onOpenNewCard,
}: GiftCardFiltersProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Išči po številki kartice ali lastniku..."
              aria-label="Iskanje kartic"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-44" id="gc-status-filter">
              <SelectValue placeholder="Status filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Vsi statusi</SelectItem>
              <SelectItem value="active">Aktivna</SelectItem>
              <SelectItem value="depleted">Porabljena</SelectItem>
              <SelectItem value="expired">Potekla</SelectItem>
              <SelectItem value="suspended">Suspendirana</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={onOpenNewCard}>
            <Plus className="h-4 w-4 mr-2" />
            Nova kartica
          </Button>
        </div>
      </CardContent>
    </Card>
  )
})
