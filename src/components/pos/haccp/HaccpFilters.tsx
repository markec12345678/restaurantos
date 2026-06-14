'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Search, Filter, RotateCcw } from 'lucide-react'

interface HaccpFiltersProps {
  search: string
  onSearchChange: (_value: string) => void
  dateFrom: string
  onDateFromChange: (_value: string) => void
  dateTo: string
  onDateToChange: (_value: string) => void
  showFilters: boolean
  onShowFiltersChange: (_value: boolean) => void
  hasActiveFilters: boolean
  onReset: () => void
}

export const HaccpFilters = memo(function HaccpFilters({
  search,
  onSearchChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  showFilters,
  onShowFiltersChange,
  hasActiveFilters,
  onReset,
}: HaccpFiltersProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="I\u0161\u010Di po naslovu, opisu, zaposlenem..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => onShowFiltersChange(!showFilters)}
          >
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            Filtri datuma
            {(dateFrom || dateTo) && (
              <span className="ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] px-1">
                !
              </span>
            )}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-9" onClick={onReset}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Po\u010Disti
            </Button>
          )}
        </div>
        {showFilters && (
          <div className="flex flex-wrap gap-3 items-end mt-3 pt-3 border-t">
            <div>
              <Label className="text-xs">Od datuma</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                className="h-9 w-40"
              />
            </div>
            <div>
              <Label className="text-xs">Do datuma</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                className="h-9 w-40"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
})
