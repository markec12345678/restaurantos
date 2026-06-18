'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FileMinus, ArrowUpCircle } from 'lucide-react'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import { type InventoryItemData, type WriteOffFormData, writeOffReasons } from './constants'

// --- Props ---

interface WriteOffDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  writeOffItemId: string
  items: InventoryItemData[] | undefined
  writeOffData: WriteOffFormData
  onWriteOffDataChange: (_data: WriteOffFormData) => void
  onSubmit: () => void
  isPending: boolean
}

// --- Komponenta ---

export const WriteOffDialog = memo(function WriteOffDialog({
  open,
  onOpenChange,
  writeOffItemId,
  items,
  writeOffData,
  onWriteOffDataChange,
  onSubmit,
  isPending,
}: WriteOffDialogProps) {
  // Najdi izbrani artikel za prikaz
  const selectedItem = writeOffItemId ? (items || []).find((i) => i.id === writeOffItemId) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-red-600" />
            Razknjižba zaloge
          </DialogTitle>
        </DialogHeader>
        {selectedItem && (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 mb-3 space-y-1 text-sm">
            <p className="font-medium">{selectedItem.name}</p>
            <p className="text-muted-foreground">Trenutna zaloga: <span className="font-medium">{selectedItem.quantity} {selectedItem.unit}</span> (vrednost: €{safeToFixed(selectedItem.quantity * selectedItem.costPerUnit, 2)})</p>
          </div>
        )}
        <div className="space-y-3">
          <div>
            <Label>Vrsta *</Label>
            <Select value={writeOffData.type} onValueChange={(v) => onWriteOffDataChange({ ...writeOffData, type: v })}>
              <SelectTrigger autoFocus><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="write-off">Odpis</SelectItem>
                <SelectItem value="adjustment">Popravek inventorja</SelectItem>
                <SelectItem value="return">Vrnitev dobavitelju</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="writeoff-dialog-qty">Količina za odpis *</Label>
            <Input id="writeoff-dialog-qty" type="number" min="0.01" step="0.01" placeholder="npr. 2" value={writeOffData.quantity} onChange={(e) => onWriteOffDataChange({ ...writeOffData, quantity: e.target.value })} aria-label="npr. 2"/>
          </div>
          <div>
            <Label>Razlog *</Label>
            <Select value={writeOffData.reason} onValueChange={(v) => onWriteOffDataChange({ ...writeOffData, reason: v })}>
              <SelectTrigger><SelectValue placeholder="Izberite razlog..." /></SelectTrigger>
              <SelectContent>
                {writeOffReasons.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="writeoff-dialog-by">Izvedel</Label>
            <Input id="writeoff-dialog-by" placeholder="Ime zaposlenega" value={writeOffData.employeeName} onChange={(e) => onWriteOffDataChange({ ...writeOffData, employeeName: e.target.value })} aria-label="Ime zaposlenega"/>
          </div>
          <div>
            <Label htmlFor="writeoff-dialog-note">Opomba</Label>
            <Textarea id="writeoff-dialog-note" placeholder="Opombe..." value={writeOffData.note} onChange={(e) => onWriteOffDataChange({ ...writeOffData, note: e.target.value })} rows={2} aria-label="Opombe"/>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={onSubmit} disabled={!writeOffData.quantity || !writeOffData.reason || isPending} variant="destructive">
            <FileMinus className="h-4 w-4 mr-2" />
            {isPending ? 'Izvajam...' : 'Potrdi razknjižbo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
