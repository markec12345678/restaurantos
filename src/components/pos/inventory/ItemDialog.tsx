'use client'

import { memo, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { type InventoryItemData, type ItemFormData, categoryLabels, formCategoryOptions } from './constants'

// --- Props ---

interface ItemDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  editingItem: InventoryItemData | null
  formData: ItemFormData
  onFormDataChange: (_data: ItemFormData) => void
  onSubmit: () => void
  menuItems: { id: string; name: string }[] | undefined
}

// --- Komponenta ---

export const ItemDialog = memo(function ItemDialog({
  open,
  onOpenChange,
  editingItem,
  formData,
  onFormDataChange,
  onSubmit,
  menuItems,
}: ItemDialogProps) {
  // FIX: track napake slike z state (prejšnja koda je manipulirala DOM direktno — ne deluje z next/image)
  const [imageError, setImageError] = useState(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Uredi artikel zaloge' : 'Dodaj artikel v zalogo'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label htmlFor="inv-name">Ime *</Label><Input id="inv-name" value={formData.name} onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })} autoFocus /></div>
          <div>
            <Label htmlFor="inv-description">Opis</Label>
            <Textarea id="inv-description" value={formData.description} onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })} placeholder="Opis artikla (npr. Goveji patty za burgerje, 150g)" rows={2} aria-label="Opis artikla (npr. Goveji patty za burgerje, 150g)"/>
          </div>
          <div>
            <Label htmlFor="inv-image">Slika (URL)</Label>
            <div className="flex gap-2">
              <Input id="inv-image" value={formData.image} onChange={(e) => { onFormDataChange({ ...formData, image: e.target.value }); setImageError(false) }} placeholder="/inventory-images/artikel.png" aria-label="/inventory-images/artikel.png"/>
              {formData.image && !imageError && (
                <div className="w-10 h-10 rounded border overflow-hidden flex-shrink-0 relative">
                  <Image src={formData.image} alt="Predogled" fill sizes="40px" className="object-cover" onError={() => setImageError(true)} />
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="inv-unit">Enota</Label><Input id="inv-unit" value={formData.unit} onChange={(e) => onFormDataChange({ ...formData, unit: e.target.value })} placeholder="npr. steklenica, kg, L, kos" aria-label="npr. steklenica, kg, L, kos"/></div>
            <div><Label htmlFor="inv-quantity">Količina</Label><DecimalInput id="inv-quantity" value={formData.quantity} onValueChange={(n) => onFormDataChange({ ...formData, quantity: String(n) })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="inv-min-qty">Min. količina</Label><DecimalInput id="inv-min-qty" value={formData.minQuantity} onValueChange={(n) => onFormDataChange({ ...formData, minQuantity: String(n) })} /></div>
            <div><Label htmlFor="inv-cost">Nabavna cena/enoto (€)</Label><DecimalInput id="inv-cost" value={formData.costPerUnit} onValueChange={(n) => onFormDataChange({ ...formData, costPerUnit: String(n) })} /></div>
          </div>

          {/* Normativi */}
          <div className="border-t pt-3 space-y-3">
            <p className="text-sm font-semibold">Normativi (serviranje)</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="inv-servings">Servisov/enoto</Label>
                <DecimalInput id="inv-servings" value={formData.servingsPerUnit} onValueChange={(n) => {
                  const spu = n || 1
                  const cpu = parseFloat(formData.costPerUnit) || 0
                  onFormDataChange({ ...formData, servingsPerUnit: String(n), costPerServing: spu > 0 ? String(Math.round((cpu / spu) * 100) / 100) : '0' })
                }} />
              </div>
              <div>
                <Label htmlFor="inv-serving-size">Velikost servisa</Label>
                <Input id="inv-serving-size" value={formData.servingSize} onChange={(e) => onFormDataChange({ ...formData, servingSize: e.target.value })} placeholder="npr. 0.10L" aria-label="npr. 0.10L"/>
              </div>
              <div>
                <Label htmlFor="inv-cost-serving">Strošek/servis (€)</Label>
                <DecimalInput id="inv-cost-serving" value={formData.costPerServing} readOnly className="bg-muted" />
              </div>
            </div>
          </div>

          <div><Label htmlFor="inv-supplier">Dobavitelj</Label><Input id="inv-supplier" value={formData.supplier} onChange={(e) => onFormDataChange({ ...formData, supplier: e.target.value })} /></div>
          <div><Label htmlFor="inv-category">Kategorija</Label>
            <Select value={formData.category} onValueChange={(v) => onFormDataChange({ ...formData, category: v })}>
              <SelectTrigger id="inv-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {formCategoryOptions.map(c => (
                  <SelectItem key={c} value={c}>{categoryLabels[c] || c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Povezan meni artikel</Label>
            <Select value={formData.menuItemId || 'none'} onValueChange={(v) => onFormDataChange({ ...formData, menuItemId: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Brez" /></SelectTrigger>
              <SelectContent className="max-h-48">
                <SelectItem value="none">Brez povezave</SelectItem>
                {menuItems?.map((mi) => (
                  <SelectItem key={mi.id} value={mi.id}>{mi.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label htmlFor="inv-expiry">Rok uporabe</Label><Input id="inv-expiry" type="date" value={formData.expiryDate} onChange={(e) => onFormDataChange({ ...formData, expiryDate: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={onSubmit} disabled={!formData.name}>{editingItem ? 'Posodobi' : 'Ustvari'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
