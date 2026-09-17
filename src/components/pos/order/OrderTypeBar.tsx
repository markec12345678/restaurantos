'use client'

import { memo, useEffect } from 'react'
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
  // FIX BUG #1 + NAPAKA 2: Filter mize, ki so na voljo ali zasedene — te lahko izbere uporabnik
  // Array.isArray check prepreči TypeError: t?.filter is not a function, če bi API
  // vrnil napačen tip (npr. null ali object namesto array)
  const tablesArray = Array.isArray(tables) ? tables : []
  const availableTables = tablesArray.filter((t) => t.status === 'available' || t.status === 'occupied')
  const tablesLoading = !Array.isArray(tables) // Ni naložen — prikaži loading

  // FIX: Auto-izberi prvo prosto mizo ko uporabnik izbere "dine-in"
  // Prej: uporabnik je moral ročno klikniti dropdown in izbrati mizo.
  // Če ni izbral, selectedTable je bil null → naročilo brez mize.
  // Sedaj: ko orderType = 'dine-in' in mize so naložene in ni izbrane mize,
  // samodejno izberi prvo prosto mizo.
  //
  // QA 2026-09-17 (runda 3): NEVELJAVNE STARE MIZE — selectedTable je poznan v
  // zustand persist seji (localStorage). Če mize ne obstaja več v trenutnem
  // seznamu (npr. drug seed, brisanje mize, druga lokacija), je Select prikazal
  // PRAZNO vrednost in Badge "Miza undefined". Zdaj: neveljavna izbira →
  // ponastavi na prvo prosto mizo (ali pusti prazno, če ni prostih).
  useEffect(() => {
    if (orderType !== 'dine-in') return
    if (tablesLoading) return // čakaj seznam miz — prej ne moremo validirati
    const tableExists = selectedTable ? availableTables.some((t) => t.id === selectedTable) : false
    if (selectedTable && !tableExists) {
      // Stara/izbrisana miza — ponastavi na prvo prosto (ali null)
      const firstAvailable = availableTables.find((t) => t.status === 'available')
      setSelectedTable(firstAvailable ? firstAvailable.id : null)
      return
    }
    if (!selectedTable && availableTables.length > 0) {
      const firstAvailable = availableTables.find((t) => t.status === 'available')
      if (firstAvailable) {
        setSelectedTable(firstAvailable.id)
      }
    }
  }, [orderType, selectedTable, availableTables, tablesLoading, setSelectedTable])

  // A11Y + UX: izpisano ime mize tudi kadar persisted id ni več v seznamu
  const selectedTableNumber = tablesArray.find((t) => t.id === selectedTable)?.number

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30 flex-shrink-0">
      <Select value={orderType} onValueChange={setOrderType} aria-label="Vrsta naročila">
        <SelectTrigger className="w-32 h-8 text-xs pointer-coarse:h-11">
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
        <Select
          value={diningOptionId || 'none'}
          onValueChange={(v) => setDiningOptionId(v === 'none' ? null : v)}
          aria-label="Način postrežbe"
        >
          <SelectTrigger className="w-40 h-8 text-xs pointer-coarse:h-11">
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
        <Select
          value={selectedTable || ''}
          onValueChange={setSelectedTable}
          disabled={tablesLoading}
          aria-label="Izbira mize"
        >
          <SelectTrigger className="w-36 h-8 text-xs pointer-coarse:h-11">
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
          {selectedTableNumber ? `Miza ${selectedTableNumber}` : 'Miza —'}
        </Badge>
      )}
    </div>
  )
})
