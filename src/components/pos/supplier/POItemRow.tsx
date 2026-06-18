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
}

interface POItemRowProps {
  item: POItemDraft
  idx: number
  canRemove: boolean
  onUpdate: (_idx: number, _field: string, _value: string | number) => void
  onRemove: (_idx: number) => void
}

export const POItemRow = memo(function POItemRow({
  item,
  idx,
  canRemove,
  onUpdate,
  onRemove,
}: POItemRowProps) {
  return (
    <div className="grid grid-cols-12 gap-2 items-end">
      <div className="col-span-5">
        <Input value={item.description} onChange={e => onUpdate(idx, 'description', e.target.value)} placeholder="Opis artikla" className="h-8 text-xs" aria-label="Opis artikla"/>
      </div>
      <div className="col-span-2">
        <Input type="number" value={item.quantityOrdered} onChange={e => onUpdate(idx, 'quantityOrdered', parseFloat(e.target.value) || 0)} className="h-8 text-xs" aria-label="Količina"/>
      </div>
      <div className="col-span-1">
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
        <Input type="number" value={item.unitPrice} onChange={e => onUpdate(idx, 'unitPrice', parseFloat(e.target.value) || 0)} placeholder="Cena" className="h-8 text-xs" aria-label="Cena"/>
      </div>
      <div className="col-span-1">
        <span className="text-xs font-medium">&euro;{safeToFixed(item.quantityOrdered * item.unitPrice, 2)}</span>
      </div>
      <div className="col-span-1">
        {canRemove && (
          <Button variant="ghost" size="icon" aria-label="Odstrani" className="h-7 w-7" onClick={() => onRemove(idx)}>
            <X className="h-3 w-3 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  )
})
