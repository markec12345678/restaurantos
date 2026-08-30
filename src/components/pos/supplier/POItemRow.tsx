'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { safeToFixed, safeNum } from '@/lib/safe-format'

export interface POItemDraft {
  description: string
  quantityOrdered: number
  unit: string
  unitPrice: number
  vatRate: number
  // FIX BUG-PO-6: Dodaj inventoryItemId za povezavo z zalogo
  // Brez tega polja receive endpoint ne more posodobiti zaloge
  inventoryItemId?: string | null
}

interface POItemRowProps {
  item: POItemDraft
  idx: number
  canRemove: boolean
  inventoryItems: Array<{ id: string; name: string; unit?: string; costPerUnit?: number }>
  onUpdate: (_idx: number, _field: string, _value: string | number | null) => void
  onRemove: (_idx: number) => void
}

export const POItemRow = memo(function POItemRow({
  item,
  idx,
  canRemove,
  inventoryItems,
  onUpdate,
  onRemove,
}: POItemRowProps) {
  // FIX BUG-PO-6: Kadar uporabnik izbere obstoječi inventory item, samodejno
  // izpolni opis, enoto in ceno iz baze
  const handleInventorySelect = (inventoryItemId: string) => {
    if (inventoryItemId === 'none') {
      onUpdate(idx, 'inventoryItemId', null)
      return
    }
    const inv = (Array.isArray(inventoryItems) ? inventoryItems : []).find(i => i.id === inventoryItemId)
    if (inv) {
      onUpdate(idx, 'inventoryItemId', inventoryItemId)
      // Samodejno izpolni opis in enoto iz inventory item-a
      if (inv.name) onUpdate(idx, 'description', inv.name)
      if (inv.unit) onUpdate(idx, 'unit', inv.unit)
      if (inv.costPerUnit !== undefined) onUpdate(idx, 'unitPrice', Number(inv.costPerUnit) || 0)
    }
  }

  return (
    <div className="space-y-2 p-2 border rounded-lg">
      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-5">
          <label className="text-[9px] text-muted-foreground">Opis artikla *</label>
          <Input value={item.description} onChange={e => onUpdate(idx, 'description', e.target.value)} placeholder="Opis artikla" className="h-8 text-xs" aria-label="Opis artikla"/>
        </div>
        <div className="col-span-2">
          <label className="text-[9px] text-muted-foreground">Količina</label>
          <Input type="number" value={item.quantityOrdered} onChange={e => onUpdate(idx, 'quantityOrdered', parseFloat(e.target.value) || 0)} className="h-8 text-xs" aria-label="Količina"/>
        </div>
        <div className="col-span-1">
          <label className="text-[9px] text-muted-foreground">Enota</label>
          <Select value={item.unit} onValueChange={v => onUpdate(idx, 'unit', v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="kos">kos</SelectItem>
              <SelectItem value="kg">kg</SelectItem>
              <SelectItem value="L">L</SelectItem>
              <SelectItem value="stek.">stek.</SelectItem>
              <SelectItem value="keg">keg</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <label className="text-[9px] text-muted-foreground">Cena €</label>
          <Input type="number" value={item.unitPrice} onChange={e => onUpdate(idx, 'unitPrice', parseFloat(e.target.value) || 0)} placeholder="Cena" className="h-8 text-xs" aria-label="Cena"/>
        </div>
        <div className="col-span-1">
          <label className="text-[9px] text-muted-foreground">Skupaj</label>
          <span className="text-xs font-medium block">&euro;{safeToFixed(item.quantityOrdered * item.unitPrice, 2)}</span>
        </div>
        <div className="col-span-1">
          {canRemove && (
            <Button variant="ghost" size="icon" aria-label="Odstrani" className="h-7 w-7" onClick={() => onRemove(idx)}>
              <X className="h-3 w-3 text-destructive" />
            </Button>
          )}
        </div>
      </div>
      {/* FIX BUG-PO-6: Select za povezavo z obstoječim inventory item-om */}
      <div className="flex items-center gap-2">
        <label className="text-[9px] text-muted-foreground whitespace-nowrap">Poveži z zalogo:</label>
        <Select value={item.inventoryItemId || 'none'} onValueChange={handleInventorySelect}>
          <SelectTrigger className="h-7 text-xs flex-1">
            <SelectValue placeholder="Brez povezave (samo besedilo)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Brez povezave (samo besedilo)</SelectItem>
            {(Array.isArray(inventoryItems) ? inventoryItems : []).map(inv => (
              <SelectItem key={inv.id} value={inv.id}>
                {inv.name} ({inv.unit || 'kos'})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
})
