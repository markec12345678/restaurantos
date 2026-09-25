'use client'

import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Package, X } from 'lucide-react'
import { formatEUR } from '@/lib/safe-format'
import { t } from '@/lib/i18n'
import { isValidPack, fmtPackQty, round3Safe } from './pack-format'
import type { SupplierCatalogItem } from './SupplierCatalog'

export interface POItemDraft {
  description: string
  quantityOrdered: number
  unit: string
  unitPrice: number
  vatRate: number
  // FIX BUG-PO-6: Dodaj inventoryItemId za povezavo z zalogo
  // Brez tega polja receive endpoint ne more posodobiti zaloge
  inventoryItemId?: string | null
  // R131 (P1-13): pack kontekst iz kataloga dobavitelja (ADITIVNO).
  // Nastavljeno = vrstica je v PAKETIH (quantityOrdered/unit/unitPrice so
  // paketni); null/odsotno = legacy vrstica v osnovnih enotah (1:1 staro).
  packQty?: number | null
  packUnit?: string | null
}

interface POItemRowProps {
  item: POItemDraft
  idx: number
  canRemove: boolean
  inventoryItems: Array<{ id: string; name: string; unit?: string; costPerUnit?: number }>
  // R131 (P1-13): katalog izbranega dobavitelja (prefill v paketih) — opcijsko,
  // brez kataloga je vedenje 1:1 staro
  catalogItems?: SupplierCatalogItem[]
  onUpdate: (_idx: number, _field: string, _value: string | number | null) => void
  onRemove: (_idx: number) => void
}

export const POItemRow = memo(function POItemRow({
  item,
  idx,
  canRemove,
  inventoryItems,
  catalogItems,
  onUpdate,
  onRemove,
}: POItemRowProps) {
  // FIX BUG-PO-6: Kadar uporabnik izbere obstoječi inventory item, samodejno
  // izpolni opis, enoto in ceno iz baze
  const handleInventorySelect = (inventoryItemId: string) => {
    if (inventoryItemId === 'none') {
      onUpdate(idx, 'inventoryItemId', null)
      // R131: brez povezave z zalogo ni tudi pack konteksta
      onUpdate(idx, 'packQty', null)
      onUpdate(idx, 'packUnit', null)
      return
    }
    const inv = (Array.isArray(inventoryItems) ? inventoryItems : []).find(i => i.id === inventoryItemId)
    if (inv) {
      onUpdate(idx, 'inventoryItemId', inventoryItemId)
      // R131 (P1-13): katalog izbranega dobavitelja OVERIDE-a legacy auto-fill —
      // vrstica dobi paketno semantiko (unit=packUnit, unitPrice=pricePerPack).
      // Ročni override je dovoljen (uporabnik lahko po izbiri zamenja vrednosti).
      const cat = (Array.isArray(catalogItems) ? catalogItems : [])
        .find(c => c.inventoryItem?.id === inventoryItemId)
      if (cat && isValidPack(cat.packQty)) {
        onUpdate(idx, 'description', cat.inventoryItem?.name ?? inv.name)
        onUpdate(idx, 'unit', (typeof cat.packUnit === 'string' && cat.packUnit.trim()) ? cat.packUnit : (inv.unit ?? 'kos'))
        onUpdate(idx, 'packQty', Number(cat.packQty))
        onUpdate(idx, 'packUnit', (typeof cat.packUnit === 'string' && cat.packUnit.trim()) ? cat.packUnit : null)
        onUpdate(idx, 'unitPrice', Number(cat.pricePerPack) || 0)
        return
      }
      // Legacy auto-fill (brez katalog linije) — počisti morebitni prejšnji pack kontekst
      onUpdate(idx, 'packQty', null)
      onUpdate(idx, 'packUnit', null)
      // Samodejno izpolni opis in enoto iz inventory item-a
      if (inv.name) onUpdate(idx, 'description', inv.name)
      if (inv.unit) onUpdate(idx, 'unit', inv.unit)
      if (inv.costPerUnit !== undefined) onUpdate(idx, 'unitPrice', Number(inv.costPerUnit) || 0)
    }
  }

  // R131: živi pack hint — packages × packQty = base qty (osnovna enota iz inventory item-a)
  const packed = isValidPack(item.packQty)
  const baseUnit = (Array.isArray(inventoryItems) ? inventoryItems : [])
    .find(i => i.id === item.inventoryItemId)?.unit ?? ''
  const baseQty = packed ? round3Safe((Number(item.quantityOrdered) || 0) * Number(item.packQty)) : 0

  return (
    <div className="space-y-2 p-2 border rounded-lg">
      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-5">
          <label className="text-[9px] text-muted-foreground">Opis artikla *</label>
          <Input value={item.description} onChange={e => onUpdate(idx, 'description', e.target.value)} placeholder="Opis artikla" className="h-8 text-xs" aria-label="Opis artikla"/>
        </div>
        <div className="col-span-2">
          <label className="text-[9px] text-muted-foreground">Količina</label>
          <DecimalInput value={item.quantityOrdered} onValueChange={n => onUpdate(idx, 'quantityOrdered', n)} className="h-8 text-xs" aria-label="Količina"/>
        </div>
        <div className="col-span-1">
          <label className="text-[9px] text-muted-foreground">Enota</label>
          <Select value={item.unit} onValueChange={v => onUpdate(idx, 'unit', v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {/* FIX R131: pack enota (npr. 'vrečka') ni v fiksnem seznamu → dinamična
                  opcija, sicer Radix Select prikaže PRAZEN trigger za veljavno vrednost */}
              {item.unit && !['kos', 'kg', 'L', 'stek.', 'keg'].includes(item.unit) && (
                <SelectItem value={item.unit}>{item.unit}</SelectItem>
              )}
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
          <DecimalInput value={item.unitPrice} onValueChange={n => onUpdate(idx, 'unitPrice', n)} placeholder="Cena" className="h-8 text-xs" aria-label="Cena"/>
        </div>
        <div className="col-span-1">
          <label className="text-[9px] text-muted-foreground">Skupaj</label>
          <span className="text-xs font-medium block">{formatEUR(item.quantityOrdered * item.unitPrice)}</span>
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
      {/* R131 (P1-13): subtilen pack hint pod zapakirano vrstico —
          "2 × vrečka po 25 kg = 50 kg" (živi izračun; legacy vrstice ga ne dobijo) */}
      {packed && (
        <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Package className="h-3 w-3 shrink-0" aria-hidden="true" />
          {t('suppliers.po.packHint', {
            packs: fmtPackQty(item.quantityOrdered),
            packUnit: item.packUnit ?? 'paket',
            packQty: fmtPackQty(item.packQty),
            unit: baseUnit,
            baseQty: fmtPackQty(baseQty),
          })}
        </p>
      )}
    </div>
  )
})
