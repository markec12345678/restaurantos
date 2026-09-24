'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DecimalInput } from '@/components/ui/decimal-input'
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
  // R123 (P0-05): yield % validacija (1-100) — izven range-a je gumb disabled (fail-closed)
  const yieldNum = parseFloat(form.yieldPercent)
  const yieldValid = Number.isFinite(yieldNum) && yieldNum >= 1 && yieldNum <= 100
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
                <DecimalInput
                  id="edit-quantity"
                  value={form.quantityPerServing}
                  onValueChange={n => onFormChange({ ...form, quantityPerServing: String(n) })}
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
              <div className="space-y-2">
                <Label htmlFor="edit-yield">Yield %</Label>
                <p className="text-xs text-muted-foreground">Delež uporabnega po pripravi (100% = brez izgube)</p>
                <DecimalInput
                  id="edit-yield"
                  value={form.yieldPercent}
                  onValueChange={n => onFormChange({ ...form, yieldPercent: String(n) })}
                />
                {!yieldValid && (
                  <p className="text-xs text-destructive">Yield mora biti med 1% in 100%.</p>
                )}
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
          <Button onClick={onSubmit} disabled={isPending || !yieldValid}>
            {isPending ? 'Shranjujem...' : 'Shrani'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
