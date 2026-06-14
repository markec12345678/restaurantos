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
import { FileText, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import type { SupplierType } from './constants'

interface POItemDraft {
  description: string
  quantityOrdered: number
  unit: string
  unitPrice: number
  vatRate: number
}

interface PurchaseOrderDialogProps {
  open: boolean
  onClose: () => void
  suppliers: SupplierType[]
  selectedSupplierId: string
  inventoryItems: unknown[]
  onSave: (_data: Record<string, unknown>) => void
}

export const PurchaseOrderDialog = memo(function PurchaseOrderDialog({
  open,
  onClose,
  suppliers,
  selectedSupplierId,
  inventoryItems: _inventoryItems,
  onSave,
}: PurchaseOrderDialogProps) {
  const [supplierId, setSupplierId] = useState(selectedSupplierId)
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<POItemDraft[]>([
    { description: '', quantityOrdered: 1, unit: 'kos', unitPrice: 0, vatRate: 22 },
  ])

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setSupplierId(selectedSupplierId)
      setExpectedDate('')
      setNotes('')
      setItems([{ description: '', quantityOrdered: 1, unit: 'kos', unitPrice: 0, vatRate: 22 }])
    } else {
      onClose()
    }
  }

  const addItem = () => {
    setItems([...items, { description: '', quantityOrdered: 1, unit: 'kos', unitPrice: 0, vatRate: 22 }])
  }

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const updateItem = (idx: number, field: string, value: string | number) => {
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
      items: items.filter(i => i.description),
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
                  {suppliers.filter(s => s.isActive).map(s => (
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
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <Input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Opis artikla" className="h-8 text-xs" aria-label="Opis artikla"/>
                </div>
                <div className="col-span-2">
                  <Input type="number" value={item.quantityOrdered} onChange={e => updateItem(idx, 'quantityOrdered', parseFloat(e.target.value) || 0)} className="h-8 text-xs" aria-label="Količina"/>
                </div>
                <div className="col-span-1">
                  <Select value={item.unit} onValueChange={v => updateItem(idx, 'unit', v)}>
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
                  <Input type="number" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} placeholder="Cena" className="h-8 text-xs" aria-label="Cena"/>
                </div>
                <div className="col-span-1">
                  <span className="text-xs font-medium">&euro;{(item.quantityOrdered * item.unitPrice).toFixed(2)}</span>
                </div>
                <div className="col-span-1">
                  {items.length > 1 && (
                    <Button variant="ghost" size="icon" aria-label="Odstrani" className="h-7 w-7" onClick={() => removeItem(idx)}>
                      <X className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Skupaj */}
          <div className="flex justify-end p-3 rounded-lg bg-muted/50">
            <div className="text-right space-y-1">
              <div className="flex justify-between gap-8 text-xs">
                <span className="text-muted-foreground">Vmesna vsota:</span>
                <span className="font-medium">&euro;{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-8 text-xs">
                <span className="text-muted-foreground">DDV:</span>
                <span className="font-medium">&euro;{vatAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-8 text-sm border-t pt-1">
                <span className="font-bold">SKUPAJ:</span>
                <span className="font-bold">&euro;{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

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
