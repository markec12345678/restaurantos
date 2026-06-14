'use client'

// ─── Header z filtrom kategorij in preklopom pogleda ──────────

import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BarChart3 } from 'lucide-react'
import { type MatrixHeaderProps } from './constants'

export const MatrixHeader = memo(function MatrixHeader({
  totalItems,
  categoryFilter,
  onCategoryFilterChange,
  categories,
  viewMode,
  onViewModeChange,
}: MatrixHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-card flex-shrink-0">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold">Menu Engineering</h1>
        <Badge variant="outline" className="text-xs">{totalItems} artiklov</Badge>
      </div>
      <div className="flex items-center gap-2">
        <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
          <SelectTrigger className="w-40 h-8 text-xs" aria-label="Izberi kategorijo">
            <SelectValue placeholder="Kategorija" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vse kategorije</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === 'matrix' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 text-xs rounded-r-none"
            onClick={() => onViewModeChange('matrix')}
            aria-label="Prikaz grafa"
          >
            Graf
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 text-xs rounded-l-none"
            onClick={() => onViewModeChange('table')}
            aria-label="Prikaz tabele"
          >
            Tabela
          </Button>
        </div>
      </div>
    </div>
  )
})
