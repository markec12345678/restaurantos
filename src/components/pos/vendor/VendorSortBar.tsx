'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import type { VendorSortBarProps, SortBy } from './constants'

// ============================================
// SORTIRANJE — Izbira vrste sortiranja dobaviteljev
// ============================================

const SORT_OPTIONS: { key: SortBy; label: string }[] = [
  { key: 'score', label: 'Skupna ocena' },
  { key: 'delivery', label: 'Dobava' },
  { key: 'quality', label: 'Kakovost' },
  { key: 'price', label: 'Cena' },
]

export const VendorSortBar = memo(function VendorSortBar({ sortBy, onSortChange }: VendorSortBarProps) {
  return (
    <div className="flex gap-2">
      {SORT_OPTIONS.map(s => (
        <Button
          key={s.key}
          variant={sortBy === s.key ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSortChange(s.key)}
          aria-label={`Sortiraj po: ${s.label}`}
        >
          {s.label}
        </Button>
      ))}
    </div>
  )
})
