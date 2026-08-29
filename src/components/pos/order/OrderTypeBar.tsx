'use client'

import { memo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Users, Loader2 } from 'lucide-react'

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
  // FIX BUG #1: Filter mize, ki so na voljo ali zasedene — te lahko izbere uporabnik
  const availableTables = tables?.filter((t) => t.status === 'available' || t.status === 'occupied') || []
  const tablesLoading = !tables // Ni naložen (undefined) — prikaži loading

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
        <Select value={selectedTable || ''} onValueChange={setSelectedTable} disabled={tablesLoading}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder={tablesLoading ? 'Nalagam mize...' : 'Izberi mizo'} />
          </SelectTrigger>
          <SelectContent>
            {availableTables.length === 0 && !tablesLoading && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                Ni razpoložljivih miz
              </div>
            )}
            {availableTables.map((table) => (
              <SelectItem key={table.id} value={table.id}>
                Miza {table.number} ({table.capacity} mest)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {tablesLoading && orderType === 'dine-in' && (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
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
