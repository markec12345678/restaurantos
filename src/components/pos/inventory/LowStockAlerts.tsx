'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'
import { type InventoryItemData } from './constants'

// --- Props ---

interface LowStockAlertsProps {
  lowStockItems: InventoryItemData[]
  onRestock: (_itemId: string) => void
}

// --- Komponenta ---

export const LowStockAlerts = memo(function LowStockAlerts({
  lowStockItems,
  onRestock,
}: LowStockAlertsProps) {
  if (lowStockItems.length === 0) return null

  return (
    <Card className="border-red-200 dark:border-red-900/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <span className="font-semibold text-red-600">Opozorila nizke zaloge ({lowStockItems.length})</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {lowStockItems.slice(0, 10).map((item) => (
            <Badge key={item.id} variant="destructive" className="text-xs cursor-pointer" role="button" tabIndex={0} onClick={() => onRestock(item.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRestock(item.id) } }}>
              {item.name}: {item.quantity} {item.unit} (min: {item.minQuantity})
            </Badge>
          ))}
          {lowStockItems.length > 10 && (
            <Badge variant="destructive" className="text-xs">+{lowStockItems.length - 10} več</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
})
