'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { ItemDialogProps } from './constants'

// ============================================
// DIALOG ZA USTVARJANJE/UREJANJE ARTIKLA
// ============================================
export const ItemDialog = memo(function ItemDialog({
  open,
  onOpenChange,
  editingItem,
  itemForm,
  onItemFormChange,
  menus,
  categories,
  modifierGroups,
  onSubmit,
}: ItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Uredi artikel' : 'Dodaj artikel'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {itemForm.image && (
            <div className="w-full aspect-[16/9] rounded-lg overflow-hidden bg-muted/50">
              <img src={itemForm.image} alt="Preview" className="w-full h-full object-cover" />
            </div>
          )}
          <div>
            <Label htmlFor="item-image">URL slike</Label>
            <Input id="item-image" value={itemForm.image} onChange={(e) => onItemFormChange({ ...itemForm, image: e.target.value })} placeholder="/menu-images/ime-artikla.png" aria-label="/menu-images/ime-artikla.png" autoFocus/>
          </div>
          <div>
            <Label htmlFor="item-name">Ime</Label>
            <Input id="item-name" value={itemForm.name} onChange={(e) => onItemFormChange({ ...itemForm, name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="item-description">Opis</Label>
            <Textarea id="item-description" value={itemForm.description} onChange={(e) => onItemFormChange({ ...itemForm, description: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="item-price">Cena (€)</Label>
            <Input id="item-price" type="number" step="0.01" value={itemForm.price} onChange={(e) => onItemFormChange({ ...itemForm, price: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="item-menu">Meni</Label>
            <Select
              value={categories?.find((c) => c.id === itemForm.categoryId)?.menu?.id || ''}
              onValueChange={(menuId) => {
                const firstCatInMenu = categories?.find((c) => c.menu?.id === menuId)
                onItemFormChange({ ...itemForm, categoryId: firstCatInMenu?.id || '' })
              }}
            >
              <SelectTrigger id="item-menu"><SelectValue placeholder="Izberi meni" /></SelectTrigger>
              <SelectContent>
                {menus?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.icon} {m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="item-category">Kategorija</Label>
            <Select value={itemForm.categoryId} onValueChange={(v) => onItemFormChange({ ...itemForm, categoryId: v })}>
              <SelectTrigger id="item-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name} {cat.menu ? `(${cat.menu.name})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Dodatki (modifier skupine)</Label>
            <div className="space-y-1 mt-1">
              {modifierGroups?.map((mg) => (
                <label key={mg.id} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-accent text-sm">
                  <input
                    type="checkbox"
                    checked={itemForm.modifierGroupIds.includes(mg.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onItemFormChange({ ...itemForm, modifierGroupIds: [...itemForm.modifierGroupIds, mg.id] })
                      } else {
                        onItemFormChange({ ...itemForm, modifierGroupIds: itemForm.modifierGroupIds.filter(id => id !== mg.id) })
                      }
                    }}
                    className="rounded"
                  />
                  <span>{mg.name}</span>
                  {mg.required && <Badge variant="destructive" className="text-[9px] h-3.5 px-1 ml-auto">Obvezno</Badge>}
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="item-available" checked={itemForm.isAvailable} onCheckedChange={(c) => onItemFormChange({ ...itemForm, isAvailable: c })} />
            <Label htmlFor="item-available">Na voljo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={onSubmit} disabled={!itemForm.name || !itemForm.price || !itemForm.categoryId}>
            {editingItem ? 'Posodobi' : 'Ustvari'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
