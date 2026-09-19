'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Pencil, Plus } from 'lucide-react'
import type { MenuDialogProps } from './constants'

// ============================================
// DIALOG ZA MENI — ustvarjanje IN urejanje (RUNDA 67)
// Urejevalni način: naslov "Uredi meni", gumb "Shrani spremembe",
// ŽIVI predogled ploščice + stikalo aktivnosti (samo urejanje).
// ============================================
export const MenuDialog = memo(function MenuDialog({
  open,
  onOpenChange,
  menuForm,
  onMenuFormChange,
  editingMenu,
  onSubmit,
}: MenuDialogProps) {
  const isEditing = !!editingMenu
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing
              ? (<><Pencil className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Uredi meni</>)
              : (<><Plus className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Dodaj meni</>)}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* RUNDA 67: živi predogled — vizualna dvojica kartice v tabu */}
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-colors"
              style={{ backgroundColor: `${menuForm.color}20` }}
            >
              {menuForm.icon || '📋'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{menuForm.name || (isEditing ? 'Brez imena' : 'Novi meni')}</p>
              <p className="text-xs text-muted-foreground">Predogled kartice</p>
            </div>
          </div>
          <div>
            <Label htmlFor="menu-name">Ime</Label>
            <Input id="menu-name" value={menuForm.name} onChange={(e) => onMenuFormChange({ ...menuForm, name: e.target.value })} placeholder="npr. Hrana, Pijača" aria-label="npr. Hrana, Pijača" />
          </div>
          <div>
            <Label htmlFor="menu-icon">Ikona (emoji)</Label>
            <Input id="menu-icon" value={menuForm.icon} onChange={(e) => onMenuFormChange({ ...menuForm, icon: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="menu-color">Barva</Label>
            <Input id="menu-color" type="color" value={menuForm.color} onChange={(e) => onMenuFormChange({ ...menuForm, color: e.target.value })} className="h-10" />
          </div>
          {isEditing && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="menu-active" className="text-sm font-medium">Meni je aktiven</Label>
                <p className="text-xs text-muted-foreground">Neaktivni meni ni viden prodajalcem.</p>
              </div>
              <Switch
                id="menu-active"
                checked={menuForm.isActive}
                onCheckedChange={(checked) => onMenuFormChange({ ...menuForm, isActive: checked })}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={onSubmit} disabled={!menuForm.name}>
            {isEditing ? 'Shrani spremembe' : 'Ustvari'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
