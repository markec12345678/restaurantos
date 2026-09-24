'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import type { MenuItemData, InventoryData, AddFormState } from './constants'
import { formatEUR, safeToFixed } from '@/lib/safe-format'

// ============================================
// TIPI PROPS
// ============================================
interface AddRecipeDialogProps {
  /** Ali je dialog odprt */
  open: boolean
  /** Sproži spremembo odprtosti dialoga */
  onOpenChange: (_open: boolean) => void
  /** Podatki obrazca za dodajanje */
  form: AddFormState
  /** Posodobi obrazec */
  onFormChange: (_form: AddFormState) => void
  /** Seznam meni artiklov */
  menuItems: MenuItemData[] | undefined
  /** Sortirani založni artikli */
  sortedInventoryItems: InventoryData[]
  /** Vsi založni artikli (za iskanje po ID) */
  inventoryItems: InventoryData[] | undefined
  /** Ali se dodajanje izvaja */
  isPending: boolean
  /** Kliči mutacijo za dodajanje */
  onSubmit: () => void
}

// ============================================
// DIALOG: DODAJ SESTAVINO V RECEPT
// ============================================
export const AddRecipeDialog = memo(function AddRecipeDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  menuItems,
  sortedInventoryItems,
  inventoryItems,
  isPending,
  onSubmit,
}: AddRecipeDialogProps) {
  // R123 (P0-05): yield % validacija (1-100) — izven range-a je gumb disabled (fail-closed)
  const yieldNum = parseFloat(form.yieldPercent)
  const yieldValid = Number.isFinite(yieldNum) && yieldNum >= 1 && yieldNum <= 100
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Dodaj sestavino v recept
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="add-menu-item">Meni artikel *</Label>
            <Select value={form.menuItemId} onValueChange={v => onFormChange({ ...form, menuItemId: v })}>
              <SelectTrigger id="add-menu-item" autoFocus><SelectValue placeholder="Izberite artikel iz jedilnika..." /></SelectTrigger>
              <SelectContent className="max-h-60">
                {menuItems?.map(mi => (
                  <SelectItem key={mi.id} value={mi.id}>{mi.name} ({formatEUR(mi.price)})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-inventory-item">Založni artikel *</Label>
            <Select value={form.inventoryItemId} onValueChange={v => {
              const inv = inventoryItems?.find(i => i.id === v)
              onFormChange({
                ...form,
                inventoryItemId: v,
                unit: inv?.unit || '',
              })
            }}>
              <SelectTrigger id="add-inventory-item"><SelectValue placeholder="Izberite sestavino iz zaloge..." /></SelectTrigger>
              <SelectContent className="max-h-60">
                {sortedInventoryItems.map(inv => (
                  <SelectItem key={inv.id} value={inv.id}>
                    {inv.name} — {formatEUR(inv.costPerUnit)}/{inv.unit} (zaloga: {inv.quantity} {inv.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="add-quantity">Količina na porcijo *</Label>
              <DecimalInput
                id="add-quantity"
                value={form.quantityPerServing}
                onValueChange={n => onFormChange({ ...form, quantityPerServing: String(n) })}
                placeholder="npr. 0.25"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-unit">Enota</Label>
              <Input
                id="add-unit"
                value={form.unit}
                onChange={e => onFormChange({ ...form, unit: e.target.value })}
                placeholder="npr. kg, L, kos"
                aria-label="npr. kg, L, kos"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-yield">Yield %</Label>
              <p className="text-xs text-muted-foreground">Delež uporabnega po pripravi (100% = brez izgube)</p>
              <DecimalInput
                id="add-yield"
                value={form.yieldPercent}
                onValueChange={n => onFormChange({ ...form, yieldPercent: String(n) })}
                placeholder="100"
              />
              {!yieldValid && (
                <p className="text-xs text-destructive">Yield mora biti med 1% in 100%.</p>
              )}
            </div>
          </div>
          {/* Predračun stroška */}
          {form.inventoryItemId && form.quantityPerServing && (() => {
            const inv = inventoryItems?.find(i => i.id === form.inventoryItemId)
            if (!inv) return null
            // R123 (P0-05): predračun skozi yield — RAW = usable / (yield/100),
            // strošek = RAW × nabavna cena (= usable × cena / (yield/100))
            const yieldPct = yieldValid ? yieldNum : 100
            const rawQty = (parseFloat(form.quantityPerServing) || 0) / (yieldPct / 100)
            const cost = rawQty * inv.costPerUnit
            return (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Nabavna cena/enoto:</span><span>{formatEUR(inv.costPerUnit)}/{inv.unit}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Količina na porcijo:</span><span>{form.quantityPerServing} {form.unit || inv.unit}</span></div>
                {yieldPct < 100 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Potrebno surovo (z izgubo):</span><span>{safeToFixed(rawQty, 3)} {form.unit || inv.unit}</span></div>
                )}
                <div className="flex justify-between font-semibold"><span>Strošek na porcijo:</span><span className="text-red-600">{formatEUR(cost)}</span></div>
              </div>
            )
          })()}
          <div className="space-y-2">
            <Label htmlFor="add-notes">Opombe</Label>
            <Input
              id="add-notes"
              value={form.notes}
              onChange={e => onFormChange({ ...form, notes: e.target.value })}
              placeholder="Opombe za pripravo..."
              aria-label="Opombe za pripravo"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button
            onClick={onSubmit}
            disabled={!form.menuItemId || !form.inventoryItemId || !form.quantityPerServing || !yieldValid || isPending}
          >
            {isPending ? 'Dodajam...' : 'Dodaj sestavino'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
