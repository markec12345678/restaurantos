'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import type { CategoryDialogProps } from './constants'

// ============================================
// DIALOG ZA USTVARJANJE KATEGORIJE
// ============================================
export const CategoryDialog = memo(function CategoryDialog({
  open,
  onOpenChange,
  catForm,
  onCatFormChange,
  menus,
  onSubmit,
}: CategoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dodaj kategorijo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="cat-menu">Meni</Label>
            <Select value={catForm.menuId} onValueChange={(v) => onCatFormChange({ ...catForm, menuId: v })}>
              <SelectTrigger id="cat-menu" autoFocus><SelectValue placeholder="Izberi meni" /></SelectTrigger>
              <SelectContent>
                {menus?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.icon} {m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cat-name">Ime</Label>
            <Input id="cat-name" value={catForm.name} onChange={(e) => onCatFormChange({ ...catForm, name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="cat-icon">Ikona (emoji)</Label>
            <Input id="cat-icon" value={catForm.icon} onChange={(e) => onCatFormChange({ ...catForm, icon: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="cat-color">Barva</Label>
            <Input id="cat-color" type="color" value={catForm.color} onChange={(e) => onCatFormChange({ ...catForm, color: e.target.value })} className="h-10" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={onSubmit} disabled={!catForm.name || !catForm.menuId}>
            Ustvari
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
