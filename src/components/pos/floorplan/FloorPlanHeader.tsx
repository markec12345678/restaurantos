'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, LayoutGrid } from 'lucide-react'
import type { FloorPlanHeaderProps } from './constants'

// R114 (ref #111): pravilna slovenska sklonska ujemanja števcev.
// Prej je bilo "2 prostih", "1 zasedenih" — vedno 5+ oblika. Ista oblika
// (1 / 2 / 3+) kot floorLabel v reservation/FloorPlanView.tsx.
const tableStatusForms: Record<string, [string, string, string]> = {
  // [1, 2 (dvojina), 3+]
  available: ['prosta', 'prosti', 'prostih'],
  occupied: ['zasedena', 'zasedeni', 'zasedenih'],
  reserved: ['rezervirana', 'rezervirani', 'rezerviranih'],
}

function statusCountForm(status: keyof typeof tableStatusForms, count: number): string {
  const [one, two, many] = tableStatusForms[status]
  if (count === 1) return one
  if (count === 2) return two
  return many
}

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
            <Badge variant="outline" className="text-xs h-6 tabular-nums">
              <span className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5" />
              {availableCount} {statusCountForm('available', availableCount)}
            </Badge>
            <Badge variant="outline" className="text-xs h-6 tabular-nums">
              <span className="h-2 w-2 rounded-full bg-red-500 mr-1.5" />
              {occupiedCount} {statusCountForm('occupied', occupiedCount)}
            </Badge>
            <Badge variant="outline" className="text-xs h-6 tabular-nums">
              <span className="h-2 w-2 rounded-full bg-amber-500 mr-1.5" />
              {reservedCount} {statusCountForm('reserved', reservedCount)}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="pointer-coarse:h-11 pointer-coarse:px-4 pointer-coarse:text-sm"
            onClick={onAutoArrange}
          >
            <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
            Samodejna postavitev
          </Button>
          <Button
            size="sm"
            className="pointer-coarse:h-11 pointer-coarse:px-4 pointer-coarse:text-sm"
            onClick={onOpenCreate}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Dodaj mizo
          </Button>
        </div>
      </div>
    </div>
  )
})
