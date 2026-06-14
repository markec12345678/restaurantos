'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SEVERITY_CONFIG, type AlertFilterBarProps } from './constants'

// Filtri po resnosti
export const AlertFilterBar = memo(function AlertFilterBar({
  filterSeverity,
  onFilterChange,
  criticalCount,
  warningCount,
  lowCount,
}: AlertFilterBarProps) {
  return (
    <div className="flex gap-2">
      {['all', 'critical', 'warning', 'low'].map(sev => (
        <Button
          key={sev}
          variant={filterSeverity === sev ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFilterChange(sev)}
          aria-label={sev === 'all' ? 'Prikaži vse' : `Filtriraj po ${SEVERITY_CONFIG[sev as keyof typeof SEVERITY_CONFIG].label.toLowerCase()}`}
        >
          {sev === 'all' ? 'Vsi' : SEVERITY_CONFIG[sev as keyof typeof SEVERITY_CONFIG].label}
          {sev !== 'all' && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {sev === 'critical' ? criticalCount : sev === 'warning' ? warningCount : lowCount}
            </Badge>
          )}
        </Button>
      ))}
    </div>
  )
})
