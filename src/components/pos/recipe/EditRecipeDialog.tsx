'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Pencil } from 'lucide-react'
import type { RecipeItemData, EditFormState } from './constants'

// ============================================
// TIPI PROPS
// ============================================
interface EditRecipeDialogProps {
  /** Ali je dialog odprt */
  open: boolean
  /** Sproži spremembo odprtosti dialoga */
  onOpenChange: (_open: boolean) => void
  /** Sestavina, ki se ureja */
  editItem: RecipeItemData | null
  /** Podatki obrazca za urejanje */
  form: EditFormState
  /** Posodobi obrazec */
  onFormChange: (_form: EditFormState) => void
  /** Ali se shranjevanje izvaja */
  isPending: boolean
  /** Kliči mutacijo za shranjevanje */
  onSubmit: () => void
}

// ============================================
// DIALOG: UREDI SESTAVINO
// ============================================
export const EditRecipeDialog = memo(function EditRecipeDialog({
  open,
  onOpenChange,
  editItem,
  form,
  onFormChange,
  isPending,
  onSubmit,
}: EditRecipeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Uredi sestavino
          </DialogTitle>
        </DialogHeader>
        {editItem && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Artikel:</span><span className="font-medium">{editItem.menuItem.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Sestavina:</span><span className="font-medium">{editItem.inventoryItem.name}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-quantity">Količina na porcijo</Label>
                <Input
                  id="edit-quantity"
                  type="number"
                  step="0.01"
                  value={form.quantityPerServing}
                  onChange={e => onFormChange({ ...form, quantityPerServing: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-unit">Enota</Label>
                <Input
                  id="edit-unit"
                  value={form.unit}
                  onChange={e => onFormChange({ ...form, unit: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Opombe</Label>
              <Input
                id="edit-notes"
                value={form.notes}
                onChange={e => onFormChange({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={onSubmit} disabled={isPending}>
            {isPending ? 'Shranjujem...' : 'Shrani'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
