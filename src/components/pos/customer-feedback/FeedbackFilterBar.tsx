'use client'

// ============================================
// VRSTICA Z FILTRIRANJE MNENJ
// ============================================

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Filter } from 'lucide-react'
import { FILTER_OPTIONS } from './constants'
import type { FeedbackFilterBarProps } from './constants'

export const FeedbackFilterBar = memo(function FeedbackFilterBar({ filterRating, onFilterChange }: FeedbackFilterBarProps) {
  return (
    <div className="flex items-center gap-2">
      <Filter className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Filtriraj:</span>
      {FILTER_OPTIONS.map(val => (
        <Button
          key={val}
          variant={filterRating === val ? 'default' : 'outline'}
          size="sm"
          className="h-6 text-[10px] px-2"
          onClick={() => onFilterChange(val)}
          aria-label={val === 'all' ? 'Prikazi vsa mnenja' : `Filtriraj po ${val} zvezdicah`}
        >
          {val === 'all' ? 'Vse' : `${val} \u2B50`}
        </Button>
      ))}
    </div>
  )
})
