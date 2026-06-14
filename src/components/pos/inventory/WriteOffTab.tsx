'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FileMinus, SlidersHorizontal, ArrowUpCircle } from 'lucide-react'
import { type InventoryItemData, type WriteOffFormData, writeOffReasons } from './constants'

// --- Props ---

interface WriteOffTabProps {
  items: InventoryItemData[] | undefined
  sortedItems: InventoryItemData[]
  writeOffItemId: string
  onWriteOffItemIdChange: (_id: string) => void
  writeOffData: WriteOffFormData
  onWriteOffDataChange: (_data: WriteOffFormData) => void
  onWriteOffSubmit: () => void
  isPending: boolean
}

// --- Komponenta ---

export const WriteOffTab = memo(function WriteOffTab({
  items,
  sortedItems,
  writeOffItemId,
  onWriteOffItemIdChange,
  writeOffData,
  onWriteOffDataChange,
  onWriteOffSubmit,
  isPending,
}: WriteOffTabProps) {
  // Najdi izbrani artikel za prikaz podatkov
  const selectedItem = writeOffItemId ? (items || []).find((i) => i.id === writeOffItemId) : null

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileMinus className="h-5 w-5 text-red-600" />
            Razknjižba zaloge
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Odpis zaloge za kvar, razbitje, izgubo ali popravek inventorja. Ob razknjižbi se količina samodejno odšteje od zaloge in ustvari se transakcijski zapis.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Izberite artikel</Label>
              <Select value={writeOffItemId} onValueChange={onWriteOffItemIdChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Izberite artikel iz zaloge..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {sortedItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} — {item.quantity} {item.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedItem && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Trenutna zaloga:</span><span className="font-medium">{selectedItem.quantity} {selectedItem.unit}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Nabavna vrednost:</span><span className="font-medium">€{(selectedItem.quantity * selectedItem.costPerUnit).toFixed(2)}</span></div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <Label>Vrsta razknjižbe *</Label>
                <Select value={writeOffData.type} onValueChange={(v) => onWriteOffDataChange({ ...writeOffData, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="write-off">Odpis (kvar, razbitje, izguba)</SelectItem>
                    <SelectItem value="adjustment">Popravek inventorja</SelectItem>
                    <SelectItem value="return">Vrnitev dobavitelju</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="writeoff-qty">Količina za odpis (v enotah) *</Label>
                <Input id="writeoff-qty" type="number" min="0.01" step="0.01" placeholder="npr. 2" value={writeOffData.quantity} onChange={(e) => onWriteOffDataChange({ ...writeOffData, quantity: e.target.value })} aria-label="npr. 2"/>
                {selectedItem && writeOffData.quantity && (() => {
                  const newQty = Math.max(0, selectedItem.quantity - parseFloat(writeOffData.quantity))
                  const costLoss = parseFloat(writeOffData.quantity) * selectedItem.costPerUnit
                  return (
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <p>Nova zaloga: <span className="font-medium text-red-600">{newQty} {selectedItem.unit}</span></p>
                      <p>Strošek odpisa: <span className="font-medium text-red-600">€{costLoss.toFixed(2)}</span></p>
                    </div>
                  )
                })()}
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
                <Label htmlFor="writeoff-by">Izvedel</Label>
                <Input id="writeoff-by" placeholder="Ime zaposlenega" value={writeOffData.employeeName} onChange={(e) => onWriteOffDataChange({ ...writeOffData, employeeName: e.target.value })} aria-label="Ime zaposlenega"/>
              </div>
              <div>
                <Label htmlFor="writeoff-note">Opomba</Label>
                <Textarea id="writeoff-note" placeholder="Dodatne opombe..." value={writeOffData.note} onChange={(e) => onWriteOffDataChange({ ...writeOffData, note: e.target.value })} rows={2} aria-label="Dodatne opombe"/>
              </div>
              <Button className="w-full" variant="destructive" onClick={onWriteOffSubmit} disabled={!writeOffItemId || !writeOffData.quantity || !writeOffData.reason || isPending}>
                <FileMinus className="h-4 w-4 mr-2" />
                {isPending ? 'Izvajam...' : 'Izvedi razknjižbo'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hitri odpis - navodila */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5" />
            Hitri odpis iz zaloge
          </CardTitle>
          <p className="text-sm text-muted-foreground">Kliknite na gumb <ArrowUpCircle className="h-3 w-3 inline text-red-600" /> na artiklu v zavihku Zaloge za hitro razknjižbo posameznega artikla.</p>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">Kako se razknjižuje zaloga:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li><strong>Avtomatsko ob prodaji</strong> — ko je naročilo ustvarjeno (oddano), se zaloga samodejno zmanjša glede na receptne normative ali servise na enoto; ob preklicu/stornu naročila se zaloga samodejno vrne</li>
              <li><strong>Ročni odpis</strong> — za kvar, razbitje, izgubo ali popravek inventorja (ta obrazec zgoraj)</li>
              <li><strong>Vrnitev dobavitelju</strong> — ko vračate blago dobavitelju</li>
              <li><strong>Popravek inventorja</strong> — ob fizičnem štetju zaloge, ko dejansko stanje ne ustreza sistemu</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </>
  )
})
