'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, LayoutGrid } from 'lucide-react'
import type { FloorPlanHeaderProps } from './constants'

// Glava tlorisa s stanjem miz in dejanji
export const FloorPlanHeader = memo(function FloorPlanHeader({
  availableCount,
  occupiedCount,
  reservedCount,
  onAutoArrange,
  onOpenCreate,
}: FloorPlanHeaderProps) {
  return (
    <div className="flex-shrink-0 border-b bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutGrid className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Tloris restavracije</h2>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs h-6">
              <span className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5" />
              {availableCount} prostih
            </Badge>
            <Badge variant="outline" className="text-xs h-6">
              <span className="h-2 w-2 rounded-full bg-red-500 mr-1.5" />
              {occupiedCount} zasedenih
            </Badge>
            <Badge variant="outline" className="text-xs h-6">
              <span className="h-2 w-2 rounded-full bg-amber-500 mr-1.5" />
              {reservedCount} rezerviranih
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onAutoArrange}>
            <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
            Samodejna postavitev
          </Button>
          <Button size="sm" onClick={onOpenCreate}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Dodaj mizo
          </Button>
        </div>
      </div>
    </div>
  )
})
