'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Truck, ArrowDownCircle } from 'lucide-react'
import { type InventoryItemData, type RestockFormData } from './constants'

// --- Props ---

interface RestockDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  restockItemId: string
  items: InventoryItemData[] | undefined
  restockData: RestockFormData
  onRestockDataChange: (_data: RestockFormData) => void
  onSubmit: () => void
  isPending: boolean
}

// --- Komponenta ---

export const RestockDialog = memo(function RestockDialog({
  open,
  onOpenChange,
  restockItemId,
  items,
  restockData,
  onRestockDataChange,
  onSubmit,
  isPending,
}: RestockDialogProps) {
  // Najdi izbrani artikel za prikaz
  const selectedItem = restockItemId ? (items || []).find((i) => i.id === restockItemId) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownCircle className="h-5 w-5 text-green-600" />
            Vnos nabave
          </DialogTitle>
        </DialogHeader>
        {selectedItem && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 mb-3 space-y-1 text-sm">
            <p className="font-medium">{selectedItem.name}</p>
            <p className="text-muted-foreground">Trenutna zaloga: <span className="font-medium">{selectedItem.quantity} {selectedItem.unit}</span></p>
          </div>
        )}
        <div className="space-y-3">
          <div>
            <Label htmlFor="restock-dialog-qty">Količina (v enotah) *</Label>
            <Input id="restock-dialog-qty" type="number" min="0.01" step="0.01" placeholder="npr. 12" value={restockData.quantity} onChange={(e) => onRestockDataChange({ ...restockData, quantity: e.target.value })} aria-label="npr. 12" autoFocus/>
          </div>
          <div>
            <Label htmlFor="restock-dialog-cost">Nabavna cena na enoto (€)</Label>
            <Input id="restock-dialog-cost" type="number" step="0.01" placeholder="Pustite prazno za trenutno" value={restockData.costPerUnit} onChange={(e) => onRestockDataChange({ ...restockData, costPerUnit: e.target.value })} aria-label="Pustite prazno za trenutno"/>
          </div>
          <div>
            <Label htmlFor="restock-dialog-po">Št. dobavnice</Label>
            <Input id="restock-dialog-po" placeholder="npr. DN-2024-001" value={restockData.supplierDoc} onChange={(e) => onRestockDataChange({ ...restockData, supplierDoc: e.target.value })} aria-label="npr. DN-2024-001"/>
          </div>
          <div>
            <Label htmlFor="restock-dialog-received-by">Prevzel</Label>
            <Input id="restock-dialog-received-by" placeholder="Ime zaposlenega" value={restockData.employeeName} onChange={(e) => onRestockDataChange({ ...restockData, employeeName: e.target.value })} aria-label="Ime zaposlenega"/>
          </div>
          <div>
            <Label htmlFor="restock-dialog-note">Opomba</Label>
            <Textarea id="restock-dialog-note" placeholder="Opombe..." value={restockData.note} onChange={(e) => onRestockDataChange({ ...restockData, note: e.target.value })} rows={2} aria-label="Opombe"/>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Prekliči</Button>
          <Button onClick={onSubmit} disabled={!restockData.quantity || isPending} className="bg-green-600 hover:bg-green-700">
            <Truck className="h-4 w-4 mr-2" />
            {isPending ? 'Vnašam...' : 'Potrdi nabavo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
