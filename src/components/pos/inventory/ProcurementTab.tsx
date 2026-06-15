'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'
import { type InventoryItemData, type RestockFormData } from './constants'
import dynamic from 'next/dynamic'

const ProcurementForm = dynamic(() => import('./ProcurementForm').then(m => ({ default: m.ProcurementForm })), { ssr: false })

interface ProcurementTabProps {
  items: InventoryItemData[] | undefined
  sortedItems: InventoryItemData[]
  lowStockItems: InventoryItemData[]
  restockItemId: string
  onRestockItemIdChange: (_id: string) => void
  restockData: RestockFormData
  onRestockDataChange: (_data: RestockFormData) => void
  onRestockSubmit: () => void
  isPending: boolean
  onQuickRestock: (_itemId: string) => void
}

export const ProcurementTab = memo(function ProcurementTab({
  items,
  sortedItems,
  lowStockItems,
  restockItemId,
  onRestockItemIdChange,
  restockData,
  onRestockDataChange,
  onRestockSubmit,
  isPending,
  onQuickRestock,
}: ProcurementTabProps) {
  return (
    <>
      <ProcurementForm
        items={items}
        sortedItems={sortedItems}
        restockItemId={restockItemId}
        onRestockItemIdChange={onRestockItemIdChange}
        restockData={restockData}
        onRestockDataChange={onRestockDataChange}
        onRestockSubmit={onRestockSubmit}
        isPending={isPending}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Artikli pod minimumom ({lowStockItems.length})
          </CardTitle>
          <p className="text-sm text-muted-foreground">Kliknite na artikel za hitro vnašanje nabave</p>
        </CardHeader>
        <CardContent>
          {lowStockItems.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">Vsi artikli so nad minimalno količino</p>
          ) : (
            <div className="space-y-2">
              {lowStockItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors" role="button" tabIndex={0} onClick={() => onQuickRestock(item.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onQuickRestock(item.id) } }}>
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${item.quantity <= 0 ? 'bg-red-500' : item.quantity <= item.minQuantity * 0.5 ? 'bg-orange-500' : 'bg-yellow-500'}`}><span className="sr-only">{item.quantity <= 0 ? 'Brez zaloge' : item.quantity <= item.minQuantity * 0.5 ? 'Kritično nizka zaloga' : 'Nizka zaloga'}</span></div>
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.supplier || 'Brez dobavitelja'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">{item.quantity} / {item.minQuantity} {item.unit}</p>
                    <p className="text-xs text-red-500">Manjka: {Math.max(0, item.minQuantity - item.quantity)} {item.unit}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
})
