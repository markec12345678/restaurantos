'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Search, RotateCcw } from 'lucide-react'
import { tierConfig } from './constants'

// --- Props ---

interface LoyaltyFiltersProps {
  search: string
  tierFilter: string
  showInactive: boolean
  onSearchChange: (_e: React.ChangeEvent<HTMLInputElement>) => void
  onTierFilterChange: (_value: string) => void
  onShowInactiveChange: (_checked: boolean) => void
  onResetFilters: () => void
}

// --- Komponenta ---

export const LoyaltyFilters = memo(function LoyaltyFilters({
  search,
  tierFilter,
  showInactive,
  onSearchChange,
  onTierFilterChange,
  onShowInactiveChange,
  onResetFilters,
}: LoyaltyFiltersProps) {
  const hasFilters = search || tierFilter !== 'all' || showInactive

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Išči po imenu, telefonu, e-pošti..."
              value={search}
              onChange={onSearchChange}
              className="pl-9"
            />
          </div>
          <div className="w-44">
            <Select value={tierFilter} onValueChange={onTierFilterChange}>
              <SelectTrigger>
                <SelectValue placeholder="Vsi nivoji" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Vsi nivoji</SelectItem>
                {Object.entries(tierConfig).map(([key, cfg]) => {
                  const Icon = cfg.icon
                  return (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                        {cfg.label}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 h-9">
            <Switch
              checked={showInactive}
              onCheckedChange={onShowInactiveChange}
            />
            <Label className="text-sm text-muted-foreground whitespace-nowrap">Prikaži nedejavne</Label>
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-9" onClick={onResetFilters}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Počisti
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
})
