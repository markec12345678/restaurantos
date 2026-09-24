'use client'

// ============================================
// DIALOG: Zabeleži odpad (epic #115 §3, runda 119)
// ============================================
// Pravi poslovni workflow: artikel → količina → razlog → atomarna zabeležba
// (odpis zaloge + ledger v ENI transakciji na strežniku). Idempotency key
// generira client ob vsakem odprtju dialoga → retry/dvojni klik nikoli ne
// odpiše zaloge dvakrat.

import { memo, useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { authFetch } from '@/components/pos/pin-login/usePinAuth'
import { WASTE_REASONS, WASTE_REASON_LABELS } from './constants'
import { formatCurrency } from './constants'

interface InventoryPickItem {
  id: string
  name: string
  unit: string
  quantity: number | string
  category: string
  costPerUnit: number | string
}

interface LocationPickItem {
  id: string
  name: string
}

export interface WasteRecordDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  onRecorded: () => void
}

export const WasteRecordDialog = memo(function WasteRecordDialog({
  open,
  onOpenChange,
  onRecorded,
}: WasteRecordDialogProps) {
  const [items, setItems] = useState<InventoryPickItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [locations, setLocations] = useState<LocationPickItem[]>([])
  const [locationId, setLocationId] = useState('')
  const [inventoryItemId, setInventoryItemId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState<string>('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Stabilen idempotency ključ na VSAKO odprtje dialoga (R116 kanon)
  const idempotencyKey = useMemo(
    () => (open ? `waste-${crypto.randomUUID()}` : null),
    [open],
  )

  useEffect(() => {
    if (!open) return
    // reset ob odprtju
    setInventoryItemId('')
    setQuantity('')
    setReason('')
    setNote('')
    setLocationId('')
    setItemsLoading(true)
    // MODEL A: seja je avtoritativna, AMPAK super-admin brez lokacije MORA
    // podati izrecen locationId (fail-closed 400 na strežniku). /api/locations
    // je scoped: lokacijsko vezan user vidi točno svojo lokacijo (auto-izbira,
    // pošiljanje je neškodljivo — server ignorira body pri session scope-u);
    // super-admin vidi vse → izbirnik. Waiter: 403 → picker skrit, session
    // scope poskrbi.
    const loadLocations = authFetch('/api/locations')
      .then(async res => {
        if (!res.ok) return []
        const data = await res.json()
        const list: LocationPickItem[] = Array.isArray(data) ? data : (data.locations ?? [])
        return list.filter(l => l && typeof l.id === 'string')
      })
      .catch(() => [] as LocationPickItem[])
    Promise.all([
      authFetch('/api/inventory')
        .then(async res => {
          if (!res.ok) throw new Error('inventory')
          const data = await res.json()
          const list: InventoryPickItem[] = Array.isArray(data) ? data : (data.items ?? [])
          return list.filter(i => i && typeof i.id === 'string')
        }),
      loadLocations,
    ])
      .then(([invList, locList]) => {
        setItems(invList)
        setLocations(locList)
        if (locList.length === 1) setLocationId(locList[0].id)
      })
      .catch(() => toast.error('Napaka pri nalaganju zaloge'))
      .finally(() => setItemsLoading(false))
  }, [open])

  const selectedItem = items.find(i => i.id === inventoryItemId)
  const quantityNum = Number(quantity.replace(',', '.'))
  const needsLocationPick = locations.length > 1
  const isValid =
    inventoryItemId.length > 0 &&
    reason.length > 0 &&
    Number.isFinite(quantityNum) &&
    quantityNum > 0 &&
    // MODEL A: če super-admin vidi več lokacij, mora izbrati eno
    (!needsLocationPick || locationId.length > 0)

  const submit = async () => {
    if (!isValid || !idempotencyKey) return
    setSubmitting(true)
    try {
      const res = await authFetch('/api/waste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventoryItemId,
          quantity: quantityNum,
          reason,
          note: note.trim(),
          idempotencyKey,
          ...(locationId ? { locationId } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(data.replay ? 'Odpad je bil že zabeležen' : 'Odpad je zabeležen — zaloga je razknjižena')
        onOpenChange(false)
        onRecorded()
      } else {
        toast.error(data.error || 'Napaka pri zabeležbi odpada')
      }
    } catch {
      toast.error('Napaka pri zabeležbi odpada')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Zabeleži odpad</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {needsLocationPick && (
            <div>
              <Label htmlFor="waste-location">Lokacija *</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger id="waste-location" aria-label="Izberi lokacijo odpada">
                  <SelectValue placeholder="Izberi lokacijo" />
                </SelectTrigger>
                <SelectContent className="max-h-64 overflow-y-auto">
                  {locations.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="waste-item">Artikel *</Label>
            <Select value={inventoryItemId} onValueChange={setInventoryItemId}>
              <SelectTrigger id="waste-item" aria-label="Izberi zalogov artikel">
                <SelectValue placeholder={itemsLoading ? 'Nalagam…' : 'Izberi artikel'} />
              </SelectTrigger>
              <SelectContent className="max-h-64 overflow-y-auto">
                {items.map(i => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name} ({Number(i.quantity)} {i.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="waste-qty">Količina *</Label>
              <Input
                id="waste-qty"
                type="number"
                min="0"
                step="0.001"
                inputMode="decimal"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder={selectedItem ? `max ${Number(selectedItem.quantity)}` : '0'}
                aria-label="Količina odpada"
              />
            </div>
            <div>
              <Label htmlFor="waste-reason">Razlog *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="waste-reason" aria-label="Izberi razlog odpada">
                  <SelectValue placeholder="Izberi razlog" />
                </SelectTrigger>
                <SelectContent className="max-h-64 overflow-y-auto">
                  {WASTE_REASONS.map(r => (
                    <SelectItem key={r} value={r}>{WASTE_REASON_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="waste-note">Opomba</Label>
            <Textarea id="waste-note" value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={1000} />
          </div>
          {selectedItem && (
            <p className="text-xs text-muted-foreground">
              Na zalogi: {Number(selectedItem.quantity)} {selectedItem.unit} · nabavna cena {formatCurrency(Number(selectedItem.costPerUnit))}/{selectedItem.unit}
              {isValid && selectedItem && (
                <> · ocena odpada: <strong>{formatCurrency(quantityNum * Number(selectedItem.costPerUnit))}</strong></>
              )}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Prekliči</Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={!isValid || submitting || !idempotencyKey}
            aria-label="Zabeleži odpad in razknjiži zalogo"
          >
            {submitting ? 'Shranjujem…' : 'Zabeleži odpad'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
