'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Truck, AlertTriangle } from 'lucide-react'
import { type InventoryItemData, type RestockFormData } from './constants'

// --- Props ---

interface ProcurementTabProps {
  items: InventoryItemData[] | undefined
  sortedItems: InventoryItemData[]
  lowStockItems: InventoryItemData[]
  restockItemId: string
  onRestockItemIdChange: (_id: string) => void
  restockData: RestockFormData
  onRestockDataChange: (_data: RestockFormData) => void
  onRestockSubmit: () => void
  isPending: boolean
  onQuickRestock: (_itemId: string) => void
}

// --- Komponenta ---

export const ProcurementTab = memo(function ProcurementTab({
  items,
  sortedItems,
  lowStockItems,
  restockItemId,
  onRestockItemIdChange,
  restockData,
  onRestockDataChange,
  onRestockSubmit,
  isPending,
  onQuickRestock,
}: ProcurementTabProps) {
  // Najdi izbrani artikel za prikaz podatkov
  const selectedItem = restockItemId ? (items || []).find((i) => i.id === restockItemId) : null

  return (
    <>
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
          {/* Hitri vnos nabave */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Izberite artikel</Label>
              <Select value={restockItemId} onValueChange={(v) => {
                onRestockItemIdChange(v)
                const item = (items || []).find((i) => i.id === v)
                if (item) {
                  onRestockDataChange({ ...restockData, costPerUnit: String(item.costPerUnit) })
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Izberite artikel iz zaloge..." />
                </SelectTrigger>
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

      {/* Hitri seznam za nabavo - artikli pod minimumom */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Artikli pod minimumom ({lowStockItems.length})
          </CardTitle>
          <p className="text-sm text-muted-foreground">Kliknite na artikel za hitro vnašanje nabave</p>
        </CardHeader>
        <CardContent>
          {lowStockItems.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">Vsi artikli so nad minimalno količino</p>
          ) : (
            <div className="space-y-2">
              {lowStockItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors" role="button" tabIndex={0} onClick={() => onQuickRestock(item.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onQuickRestock(item.id) } }}>
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${item.quantity <= 0 ? 'bg-red-500' : item.quantity <= item.minQuantity * 0.5 ? 'bg-orange-500' : 'bg-yellow-500'}`}><span className="sr-only">{item.quantity <= 0 ? 'Brez zaloge' : item.quantity <= item.minQuantity * 0.5 ? 'Kritično nizka zaloga' : 'Nizka zaloga'}</span></div>
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.supplier || 'Brez dobavitelja'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">{item.quantity} / {item.minQuantity} {item.unit}</p>
                    <p className="text-xs text-red-500">Manjka: {Math.max(0, item.minQuantity - item.quantity)} {item.unit}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
})
