'use client'

import { memo, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, UtensilsCrossed, ShoppingBag, Truck, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils'

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

// UI-REFACTOR (Sales P0): vrsta naročila je zdaj SEGMENTED CONTROL (1 tap namesto
// 2 tapa dropdowna), miza je ENA izpostavljena čipka (primarni kontekst naročila),
// podvojen Badge ("Miza 4" dvakrat) je odstranjen. Logika (auto-izbira prve
// proste mize, ponastavitev zastarele mize, ARIA oznake, loading) je NESPREMENJENA.

const ORDER_TYPES = [
  { value: 'dine-in', label: 'Na mestu', icon: UtensilsCrossed },
  { value: 'takeout', label: 'Za s seboj', icon: ShoppingBag },
  { value: 'delivery', label: 'Dostava', icon: Truck },
] as const

// ============================================
// ORDER TYPE BAR - Kontekstna vrstica naročila
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
  const selectedTableCapacity = tablesArray.find((t) => t.id === selectedTable)?.capacity

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background flex-shrink-0 flex-wrap sm:flex-nowrap">
      {/* UI-REFACTOR: segmented control — vrsta naročila z enim tapom */}
      <div
        role="radiogroup"
        aria-label="Vrsta naročila"
        className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5 flex-shrink-0"
      >
        {ORDER_TYPES.map((type) => {
          const isActive = orderType === type.value
          const Icon = type.icon
          return (
            <button
              key={type.value}
              role="radio"
              aria-checked={isActive}
              onClick={() => setOrderType(type.value)}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all pointer-coarse:px-3 pointer-coarse:py-2 pointer-coarse:text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', isActive && 'text-primary')} aria-hidden="true" />
              <span className={type.value === 'takeout' ? 'hidden sm:inline' : ''}>{type.label}</span>
            </button>
          )
        })}
      </div>

      {/* MIZA — primarni kontekst naročila (ena jasna izbira, brez podvojenega badge-a) */}
      {orderType === 'dine-in' && (
        <Select
          value={selectedTable || ''}
          onValueChange={setSelectedTable}
          disabled={tablesLoading}
          aria-label="Izbira mize"
        >
          <SelectTrigger
            className="h-8 min-w-[120px] gap-1.5 rounded-lg bg-card font-semibold text-xs shadow-sm pointer-coarse:h-10 pointer-coarse:text-sm aria-[expanded=true]:ring-1 aria-[expanded=true]:ring-ring"
            aria-label={selectedTableNumber ? `Izbrana miza ${selectedTableNumber}, spremeni mizo` : 'Izberi mizo'}
          >
            <Table2 className="h-3.5 w-3.5 text-primary flex-shrink-0" aria-hidden="true" />
            {selectedTableNumber ? (
              <span className="truncate">
                Miza <span className="font-bold">{selectedTableNumber}</span>
                {selectedTableCapacity ? <span className="ml-1 font-normal text-muted-foreground">· {selectedTableCapacity} mest</span> : null}
              </span>
            ) : (
              <SelectValue placeholder={tablesLoading ? 'Nalagam mize...' : 'Izberi mizo'} />
            )}
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
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground flex-shrink-0" />
      )}

      {/* Način postrežbe — sekundarna izbira (samo če je konfigurirana) */}
      {diningOptions && diningOptions.length > 0 && (
        <Select
          value={diningOptionId || 'none'}
          onValueChange={(v) => setDiningOptionId(v === 'none' ? null : v)}
          aria-label="Način postrežbe"
        >
          <SelectTrigger className="w-auto h-8 text-xs gap-1 rounded-lg border-dashed bg-transparent text-muted-foreground pointer-coarse:h-10 pointer-coarse:text-sm ml-auto" aria-label="Način postrežbe">
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
    </div>
  )
})
