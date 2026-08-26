'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { statusConfig } from './constants'
import type { ShiftFilterBarProps } from './constants'

// Vrstica filtrov za status zaposlenih
export const ShiftFilterBar = memo(function ShiftFilterBar({
  filterStatus,
  onFilterChange,
}: ShiftFilterBarProps) {
  return (
    <div className="flex gap-2">
      {['all', 'clocked-in', 'on-break', 'scheduled', 'clocked-out'].map(status => (
        <Button
          key={status}
          variant={filterStatus === status ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFilterChange(status)}
        >
          {status === 'all' ? 'Vsi' : statusConfig[status as keyof typeof statusConfig].label}
        </Button>
      ))}
    </div>
  )
})
