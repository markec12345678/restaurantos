'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Pencil, Plus } from 'lucide-react'
import type { CategoryDialogProps } from './constants'

// ============================================
// DIALOG ZA KATEGORIJO — ustvarjanje IN urejanje (RUNDA 66)
// Urejevalni način: naslov "Uredi kategorijo", gumb "Shrani spremembe",
// ŽIVI PREDOGLED plastičke (ikona na barvni podlagi) — takojšnja povratna
// informacija med izbiro barve/ikone.
// ============================================
export const CategoryDialog = memo(function CategoryDialog({
  open,
  onOpenChange,
  catForm,
  onCatFormChange,
  menus,
  editingCategory,
  onSubmit,
}: CategoryDialogProps) {
  const isEditing = !!editingCategory
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing
              ? (<><Pencil className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Uredi kategorijo</>)
              : (<><Plus className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Dodaj kategorijo</>)}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* RUNDA 66: živi predogled — isti vizual kot kartica v tabu */}
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-colors"
              style={{ backgroundColor: `${catForm.color}20` }}
            >
              {catForm.icon || '🍽️'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{catForm.name || (isEditing ? 'Brez imena' : 'Nova kategorija')}</p>
              <p className="text-xs text-muted-foreground">Predogled kartice</p>
            </div>
          </div>
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
            {isEditing && (
              <p className="mt-1 text-xs text-muted-foreground">
                Premik med meniji premakne tudi pripadajoče artikle.
              </p>
            )}
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
            {isEditing ? 'Shrani spremembe' : 'Ustvari'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
