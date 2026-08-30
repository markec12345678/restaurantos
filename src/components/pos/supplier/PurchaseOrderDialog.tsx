'use client'

// ============================================
// DIALOG ZA NABAVNO NAROČILO — Ustvari naročilo
// ============================================

import { memo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FileText, Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { SupplierType } from './constants'
import { POItemRow, type POItemDraft } from './POItemRow'
import { POTotals } from './POTotals'

interface PurchaseOrderDialogProps {
  open: boolean
  onClose: () => void
  suppliers: SupplierType[]
  selectedSupplierId: string
  // FIX BUG-PO-6: inventoryItems naj bo pravi tip, ne unknown[]
  inventoryItems: Array<{ id: string; name: string; unit?: string; costPerUnit?: number }>
  onSave: (_data: Record<string, unknown>) => void
}

export const PurchaseOrderDialog = memo(function PurchaseOrderDialog({
  open,
  onClose,
  suppliers,
  selectedSupplierId,
  inventoryItems,
  onSave,
}: PurchaseOrderDialogProps) {
  const [supplierId, setSupplierId] = useState(selectedSupplierId)
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  // FIX BUG-PO-6: Dodaj inventoryItemId v vsako postavko
  const [items, setItems] = useState<POItemDraft[]>([
    { description: '', quantityOrdered: 1, unit: 'kos', unitPrice: 0, vatRate: 22, inventoryItemId: null },
  ])

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setSupplierId(selectedSupplierId)
      setExpectedDate('')
      setNotes('')
      setItems([{ description: '', quantityOrdered: 1, unit: 'kos', unitPrice: 0, vatRate: 22, inventoryItemId: null }])
    } else {
      onClose()
    }
  }

  const addItem = () => {
    setItems([...items, { description: '', quantityOrdered: 1, unit: 'kos', unitPrice: 0, vatRate: 22, inventoryItemId: null }])
  }

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const updateItem = (idx: number, field: string, value: string | number | null) => {
    const updated = [...items]
    updated[idx] = { ...updated[idx], [field]: value }
    setItems(updated)
  }

  const subtotal = items.reduce((sum, item) => sum + item.quantityOrdered * item.unitPrice, 0)
  const vatAmount = items.reduce((sum, item) => sum + (item.quantityOrdered * item.unitPrice * item.vatRate / 100), 0)
  const total = subtotal + vatAmount

  const handleSave = () => {
    if (!supplierId) {
      toast.error('Izberite dobavitelja')
      return
    }
    if (items.every(i => !i.description)) {
      toast.error('Dodajte vsaj en artikel')
      return
    }

    onSave({
      supplierId,
      expectedDate: expectedDate || undefined,
      notes,
      // FIX BUG-PO-6: Posreduj inventoryItemId za vsako postavko
      // Brez tega receive endpoint ne more posodobiti zaloge
      items: items.filter(i => i.description).map(i => ({
        description: i.description,
        quantityOrdered: i.quantityOrdered,
        unit: i.unit,
        unitPrice: i.unitPrice,
        vatRate: i.vatRate,
        inventoryItemId: i.inventoryItemId || null,
      })),
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Novo nabavno naročilo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="po-supplier" className="text-xs font-medium">Dobavitelj *</label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="h-9 text-sm" id="po-supplier" autoFocus><SelectValue placeholder="Izberi dobavitelja" /></SelectTrigger>
                <SelectContent>
                  {/* FIX TypeError: e.map is not a function — suppliers je lahko objekt */}
                  {(Array.isArray(suppliers) ? suppliers : []).filter(s => s.isActive).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="po-expected" className="text-xs font-medium">Pričakovana dostava</label>
              <Input id="po-expected" type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          {/* Artikli */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Artikli</p>
              <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={addItem}>
                <Plus className="h-3 w-3 mr-1" /> Dodaj vrstico
              </Button>
            </div>
            {items.map((item, idx) => (
              <POItemRow
                key={idx}
                item={item}
                idx={idx}
                canRemove={items.length > 1}
                inventoryItems={(Array.isArray(inventoryItems) ? inventoryItems : []) as Array<{ id: string; name: string; unit?: string; costPerUnit?: number }>}
                onUpdate={updateItem}
                onRemove={removeItem}
              />
            ))}
          </div>

          {/* Skupaj */}
          <POTotals subtotal={subtotal} vatAmount={vatAmount} total={total} />

          <div>
            <label htmlFor="po-notes" className="text-xs font-medium">Opombe</label>
            <Textarea id="po-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opombe k naročilu..." className="text-sm min-h-16"/>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Prekliči</Button>
          <Button onClick={handleSave}>Ustvari naročilo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
