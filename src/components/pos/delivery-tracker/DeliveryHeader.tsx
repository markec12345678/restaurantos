'use client'

import { memo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Truck } from 'lucide-react'

interface DeliveryHeaderProps {
  activeCount: number
  deliveredCount: number
  filterStatus: string
  onFilterChange: (_status: string) => void
}

export const DeliveryHeader = memo(function DeliveryHeader({ activeCount, deliveredCount, filterStatus, onFilterChange }: DeliveryHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Truck className="h-6 w-6 text-amber-500" />
          Sledenje dostav
        </h2>
        <p className="text-muted-foreground">GPS sledenje voznikom v realnem času</p>
      </div>
      <div className="flex items-center gap-3">
        <Select value={filterStatus} onValueChange={onFilterChange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Aktivne ({activeCount})</SelectItem>
            <SelectItem value="delivered">Dostavljene ({deliveredCount})</SelectItem>
            <SelectItem value="failed">Neuspele</SelectItem>
            <SelectItem value="all">Vse</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
})
