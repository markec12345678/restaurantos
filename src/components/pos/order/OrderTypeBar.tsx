'use client'

import { memo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'

// ============================================
// TIPI
// ============================================
export interface OrderTypeBarProps {
  orderType: string
  setOrderType: (_type: string) => void
  diningOptionId: string | null
  setDiningOptionId: (_id: string | null) => void
  selectedTable: string | null
  setSelectedTable: (_tableId: string | null) => void
  tables: { id: string; number: number; capacity: number; status: string }[] | undefined
  diningOptions: { id: string; name: string; type: string }[] | undefined
}

// ============================================
// ORDER TYPE BAR - Vrstica za vrsto naročila
// ============================================
export const OrderTypeBar = memo(function OrderTypeBar({
  orderType,
  setOrderType,
  diningOptionId,
  setDiningOptionId,
  selectedTable,
  setSelectedTable,
  tables,
  diningOptions,
}: OrderTypeBarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30 flex-shrink-0">
      <Select value={orderType} onValueChange={setOrderType}>
        <SelectTrigger className="w-32 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="dine-in">🍽️ Na mestu</SelectItem>
          <SelectItem value="takeout">📦 Za s seboj</SelectItem>
          <SelectItem value="delivery">🚚 Dostava</SelectItem>
        </SelectContent>
      </Select>
      {/* Dining option iz konfiguracije */}
      {diningOptions && diningOptions.length > 0 && (
        <Select value={diningOptionId || 'none'} onValueChange={(v) => setDiningOptionId(v === 'none' ? null : v)}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="Način postrežbe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Privzeto</SelectItem>
            {diningOptions.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.type === 'dine-in' ? '🍽️' : opt.type === 'takeout' ? '📦' : '🚚'} {opt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {orderType === 'dine-in' && (
        <Select value={selectedTable || ''} onValueChange={setSelectedTable}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Izberi mizo" />
          </SelectTrigger>
          <SelectContent>
            {tables?.filter((t) => t.status === 'available' || t.status === 'occupied').map((table) => (
              <SelectItem key={table.id} value={table.id}>
                Miza {table.number} ({table.capacity} mest)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {selectedTable && orderType === 'dine-in' && (
        <Badge variant="outline" className="text-xs h-6">
          <Users className="h-3 w-3 mr-1" />
          Miza {tables?.find((t) => t.id === selectedTable)?.number}
        </Badge>
      )}
    </div>
  )
})
