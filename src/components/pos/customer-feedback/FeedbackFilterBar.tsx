'use client'

// ============================================
// VRSTICA Z FILTRIRANJE MNENJ
// P1-14 (R140-c): druga vrstica = status filter (Vsi / Novo / V obdelavi /
// Rešeno) — klient-side, pariteta obstoječega rating filtra (lokalni state).
// ============================================

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Filter } from 'lucide-react'
import {
  FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  FEEDBACK_STATUS_FILTER_LABELS,
} from './constants'
import type { FeedbackFilterBarProps } from './constants'

export const FeedbackFilterBar = memo(function FeedbackFilterBar({
  filterRating,
  onFilterChange,
  filterStatus = 'all',
  onStatusFilterChange,
}: FeedbackFilterBarProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* Ocene — NESPREMENJENO */}
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
      {/* P1-14: status filter (opcijsko — samo ko je handler podan) */}
      {onStatusFilterChange && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground pl-6">Status:</span>
          {STATUS_FILTER_OPTIONS.map(val => (
            <Button
              key={val}
              variant={filterStatus === val ? 'default' : 'outline'}
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => onStatusFilterChange(val)}
              aria-label={val === 'all' ? 'Prikazi vsa mnenja' : `Filtriraj po statusu: ${FEEDBACK_STATUS_FILTER_LABELS[val]}`}
              aria-pressed={filterStatus === val}
            >
              {FEEDBACK_STATUS_FILTER_LABELS[val]}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
})
