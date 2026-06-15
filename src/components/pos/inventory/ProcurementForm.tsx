'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Truck } from 'lucide-react'
import { type InventoryItemData, type RestockFormData } from './constants'

interface ProcurementFormProps {
  items: InventoryItemData[] | undefined
  sortedItems: InventoryItemData[]
  restockItemId: string
  onRestockItemIdChange: (_id: string) => void
  restockData: RestockFormData
  onRestockDataChange: (_data: RestockFormData) => void
  onRestockSubmit: () => void
  isPending: boolean
}

export const ProcurementForm = memo(function ProcurementForm({
  items,
  sortedItems,
  restockItemId,
  onRestockItemIdChange,
  restockData,
  onRestockDataChange,
  onRestockSubmit,
  isPending,
}: ProcurementFormProps) {
  const selectedItem = restockItemId ? (items || []).find((i) => i.id === restockItemId) : null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Truck className="h-5 w-5 text-green-600" />
          Vnos nabave
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Vnesite prevzem blaga v zalogo. Ob vnosu se količina samodejno prišteje k trenutni zalogi in ustvari se transakcijski zapis.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Izberite artikel</Label>
            <Select value={restockItemId} onValueChange={(v) => {
              onRestockItemIdChange(v)
              const item = (items || []).find((i) => i.id === v)
              if (item) onRestockDataChange({ ...restockData, costPerUnit: String(item.costPerUnit) })
            }}>
              <SelectTrigger><SelectValue placeholder="Izberite artikel iz zaloge..." /></SelectTrigger>
              <SelectContent className="max-h-60">
                {sortedItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${item.quantity <= item.minQuantity ? 'bg-red-500' : 'bg-green-500'}`}><span className="sr-only">{item.quantity <= item.minQuantity ? 'Nizka zaloga' : 'Zadostna zaloga'}</span></span>
                      {item.name} — {item.quantity} {item.unit}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedItem && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Trenutna zaloga:</span><span className="font-medium">{selectedItem.quantity} {selectedItem.unit}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Enota:</span><span className="font-medium">{selectedItem.unit}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Trenutna nabavna cena:</span><span className="font-medium">€{selectedItem.costPerUnit.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Dobavitelj:</span><span className="font-medium">{selectedItem.supplier || 'Ni določen'}</span></div>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <Label htmlFor="restock-qty">Količina (v enotah zaloge) *</Label>
              <Input id="restock-qty" type="number" min="0.01" step="0.01" placeholder="npr. 12" value={restockData.quantity} onChange={(e) => onRestockDataChange({ ...restockData, quantity: e.target.value })} aria-label="npr. 12"/>
              {selectedItem && restockData.quantity && (() => {
                const newQty = selectedItem.quantity + parseFloat(restockData.quantity)
                return <p className="text-xs text-muted-foreground mt-1">Nova zaloga: <span className="font-medium text-green-600">{newQty} {selectedItem.unit}</span></p>
              })()}
            </div>
            <div>
              <Label htmlFor="restock-cost">Nabavna cena na enoto (€)</Label>
              <Input id="restock-cost" type="number" step="0.01" placeholder="Pustite prazno za trenutno ceno" value={restockData.costPerUnit} onChange={(e) => onRestockDataChange({ ...restockData, costPerUnit: e.target.value })} aria-label="Pustite prazno za trenutno ceno"/>
            </div>
            <div>
              <Label htmlFor="restock-po">Številka dobavnice</Label>
              <Input id="restock-po" placeholder="npr. DN-2024-001" value={restockData.supplierDoc} onChange={(e) => onRestockDataChange({ ...restockData, supplierDoc: e.target.value })} aria-label="npr. DN-2024-001"/>
            </div>
            <div>
              <Label htmlFor="restock-received-by">Prevzel</Label>
              <Input id="restock-received-by" placeholder="Ime zaposlenega" value={restockData.employeeName} onChange={(e) => onRestockDataChange({ ...restockData, employeeName: e.target.value })} aria-label="Ime zaposlenega"/>
            </div>
            <div>
              <Label htmlFor="restock-note">Opomba</Label>
              <Textarea id="restock-note" placeholder="Dodatne opombe..." value={restockData.note} onChange={(e) => onRestockDataChange({ ...restockData, note: e.target.value })} rows={2} aria-label="Dodatne opombe"/>
            </div>
            <Button className="w-full" onClick={onRestockSubmit} disabled={!restockItemId || !restockData.quantity || isPending}>
              <Truck className="h-4 w-4 mr-2" />
              {isPending ? 'Vnašam...' : 'Vnesi nabavo'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
