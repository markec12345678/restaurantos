'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import type { MenuDialogProps } from './constants'

// ============================================
// DIALOG ZA USTVARJANJE MENIJA
// ============================================
export const MenuDialog = memo(function MenuDialog({
  open,
  onOpenChange,
  menuForm,
  onMenuFormChange,
  onSubmit,
}: MenuDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dodaj meni</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="menu-name">Ime</Label>
            <Input id="menu-name" value={menuForm.name} onChange={(e) => onMenuFormChange({ ...menuForm, name: e.target.value })} placeholder="npr. Hrana, Pijača" aria-label="npr. Hrana, Pijača" autoFocus/>
          </div>
          <div>
            <Label htmlFor="menu-icon">Ikona (emoji)</Label>
            <Input id="menu-icon" value={menuForm.icon} onChange={(e) => onMenuFormChange({ ...menuForm, icon: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="menu-color">Barva</Label>
            <Input id="menu-color" type="color" value={menuForm.color} onChange={(e) => onMenuFormChange({ ...menuForm, color: e.target.value })} className="h-10" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={onSubmit} disabled={!menuForm.name}>
            Ustvari
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
