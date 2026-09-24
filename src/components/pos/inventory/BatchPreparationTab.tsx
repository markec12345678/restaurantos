'use client'

// ============================================
// TAB: PRIPRAVA (BATCH PREPARATION) — epic #115 P0-04, runda 122
// ============================================
// Sub-recepture / priprava vmesnih produktov: sestavine → izdelek.
//  • Nova priprava (DRAFT): izhodni artikel + količina + sestavine (vrstice)
//  • Zaključek (COMPLETED): poraba sestavin + proizvodnja izdelka skozi
//    zalogovni ledger ('batch-consumption' / 'batch-production' → Zgodovina)
//  • Preklic (CANCELLED): brez zalogovnih učinkov
// Pariteta s StocktakeTab (R121): MODEL A izbira lokacije za super-admine,
// idempotencyKey ob kreaciji, authFetch, toast povratne informacije.

import { memo, useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  CookingPot, RefreshCw, Plus, CheckCircle2, XCircle, ArrowLeft,
  Loader2, Trash2,
} from 'lucide-react'
import { authFetch } from '@/components/pos/pin-login/usePinAuth'

interface PrepLine {
  id: string
  inventoryItemId: string
  itemName: string
  unit: string
  quantity: number
  costPerUnit: number
  inputStockTransactionId: string | null
}

interface PrepEntry {
  id: string
  locationId: string
  status: string // DRAFT | COMPLETED | CANCELLED
  outputItemId: string
  outputItemName: string
  outputUnit: string
  outputQuantity: number
  outputCostPerUnit: number
  totalInputCost: number
  note: string
  createdByName: string
  completedByName: string
  completedAt: string | null
  cancelledAt: string | null
  lineCount: number
  createdAt: string
  lines?: PrepLine[]
}

interface ItemOption {
  id: string
  name: string
  unit: string
  quantity: number
  costPerUnit: number
}

interface LocationPickItem {
  id: string
  name: string
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Osnutek', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  COMPLETED: { label: 'Zaključeno', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
  CANCELLED: { label: 'Preklicano', className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('sl-SI')
}

function fmtMoney(n: number): string {
  return n.toLocaleString('sl-SI', { style: 'currency', currency: 'EUR' })
}

interface NewLineDraft {
  inventoryItemId: string
  quantity: string
}

export const BatchPreparationTab = memo(function BatchPreparationTab() {
  const [entries, setEntries] = useState<PrepEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selected, setSelected] = useState<PrepEntry | null>(null)
  const [showNew, setShowNew] = useState(false)

  // MODEL A: super-admin brez lokacije MORA podati izrecen locationId
  // (fail-closed 400) — pariteta s StocktakeTab (R121) / WasteRecordDialog (R119).
  const [locations, setLocations] = useState<LocationPickItem[]>([])
  const [newLocationId, setNewLocationId] = useState('')
  const [items, setItems] = useState<ItemOption[]>([])

  const [newOutputItemId, setNewOutputItemId] = useState('')
  const [newOutputQuantity, setNewOutputQuantity] = useState('')
  const [newNote, setNewNote] = useState('')
  const [newLines, setNewLines] = useState<NewLineDraft[]>([{ inventoryItemId: '', quantity: '' }])
  const [isCreating, setIsCreating] = useState(false)
  const [isActing, setIsActing] = useState(false)

  const loadList = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await authFetch('/api/batch-preparations')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Napaka pri nalaganju priprav')
      }
      const data = await res.json()
      setEntries(Array.isArray(data.entries) ? data.entries : [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Napaka pri nalaganju priprav')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await authFetch(`/api/batch-preparations/${id}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Napaka pri nalaganju priprave')
      }
      const data = await res.json()
      setSelected(data.preparation)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Napaka pri nalaganju priprave')
    }
  }, [])

  const loadLocations = useCallback(async () => {
    try {
      const res = await authFetch('/api/locations')
      if (!res.ok) return
      const data = await res.json()
      const list: LocationPickItem[] = Array.isArray(data) ? data : (data.locations ?? [])
      setLocations(list.filter(l => l && typeof l.id === 'string'))
    } catch {
      setLocations([])
    }
  }, [])

  const loadItems = useCallback(async (locationId?: string) => {
    try {
      // limit=1000 pokrije tipičen katalog sestavin; izbernik ni paginiran UI
      const qs = locationId ? `?limit=1000&locationId=${encodeURIComponent(locationId)}` : '?limit=1000'
      const res = await authFetch(`/api/inventory${qs}`)
      if (!res.ok) return
      const data = await res.json()
      const list: ItemOption[] = Array.isArray(data.items) ? data.items : []
      setItems(list)
    } catch {
      setItems([])
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (showNew) {
      void loadLocations()
      void loadItems()
      setNewLocationId('')
      setNewOutputItemId('')
      setNewOutputQuantity('')
      setNewNote('')
      setNewLines([{ inventoryItemId: '', quantity: '' }])
    }
  }, [showNew, loadLocations, loadItems])

  const createPreparation = useCallback(async () => {
    const lines = newLines
      .filter(l => l.inventoryItemId && l.quantity)
      .map(l => ({ inventoryItemId: l.inventoryItemId, quantity: Number(l.quantity.replace(',', '.')) }))
    if (!newOutputItemId) {
      toast.error('Izberite izhodni artikel')
      return
    }
    if (!(Number(newOutputQuantity.replace(',', '.')) > 0)) {
      toast.error('Vnesite proizvedeno količino')
      return
    }
    if (lines.length === 0) {
      toast.error('Dodajte vsaj eno sestavino s količino')
      return
    }
    setIsCreating(true)
    try {
      const res = await authFetch('/api/batch-preparations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outputItemId: newOutputItemId,
          outputQuantity: Number(newOutputQuantity.replace(',', '.')),
          note: newNote,
          ...(newLocationId ? { locationId: newLocationId } : {}),
          idempotencyKey: `bp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          lines,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Napaka pri ustvarjanju priprave')
      toast.success(data.replay ? 'Priprava je že obstajala' : 'Priprava ustvarjena (osnutek)')
      setShowNew(false)
      await loadList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Napaka pri ustvarjanju priprave')
    } finally {
      setIsCreating(false)
    }
  }, [newOutputItemId, newOutputQuantity, newNote, newLocationId, newLines, loadList])

  const completePreparation = useCallback(async (id: string) => {
    setIsActing(true)
    try {
      const res = await authFetch(`/api/batch-preparations/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Napaka pri zaključku priprave')
      const s = data.summary
      toast.success(
        `Zaključeno — sestavine porabljene, izdelek +${s.outputQuantity} (strošek ${fmtMoney(s.outputCostPerUnit)}/enoto)`,
        { duration: 6000 },
      )
      setSelected(null)
      await loadList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Napaka pri zaključku priprave')
    } finally {
      setIsActing(false)
    }
  }, [loadList])

  const cancelPreparation = useCallback(async (id: string) => {
    setIsActing(true)
    try {
      const res = await authFetch(`/api/batch-preparations/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Napaka pri preklicu priprave')
      toast.success('Priprava preklicana')
      setSelected(null)
      await loadList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Napaka pri preklicu priprave')
    } finally {
      setIsActing(false)
    }
  }, [loadList])

  const itemLabel = (id: string) => {
    const it = items.find(i => i.id === id)
    return it ? `${it.name}` : id
  }

  // ──────────────── DETAIL VIEW ────────────────
  if (selected) {
    const meta = STATUS_META[selected.status] ?? STATUS_META.DRAFT
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Nazaj na seznam
          </Button>
          <Badge className={meta.className}>{meta.label}</Badge>
        </div>

        <div className="rounded-lg border p-4 space-y-2">
          <div className="text-sm text-muted-foreground">Izhodni artikel</div>
          <div className="font-medium">
            {selected.outputItemName} — {selected.outputQuantity} {selected.outputUnit || 'enot'}
          </div>
          {selected.status === 'COMPLETED' && (
            <div className="text-sm text-muted-foreground">
              Strošek: {fmtMoney(selected.totalInputCost)} → {fmtMoney(selected.outputCostPerUnit)}/{selected.outputUnit || 'enota'} · zaključil {selected.completedByName || '—'} {fmtDate(selected.completedAt)}
            </div>
          )}
          {selected.note && <div className="text-sm text-muted-foreground">Opomba: {selected.note}</div>}
          <div className="text-xs text-muted-foreground">Ustvaril {selected.createdByName || '—'} · {fmtDate(selected.createdAt)}</div>
        </div>

        <div className="rounded-lg border">
          <div className="px-4 py-2.5 text-sm font-medium border-b">Sestavine ({selected.lines?.length ?? 0})</div>
          <div className="max-h-96 overflow-y-auto">
            {(selected.lines ?? []).map(l => (
              <div key={l.id} className="flex items-center justify-between px-4 py-2.5 border-b last:border-b-0 text-sm">
                <div>
                  <div className="font-medium">{l.itemName}</div>
                  <div className="text-xs text-muted-foreground">
                    {l.quantity} {l.unit} × {fmtMoney(l.costPerUnit)} = {fmtMoney(l.quantity * l.costPerUnit)}
                  </div>
                </div>
                {l.inputStockTransactionId && (
                  <Badge variant="outline" className="text-xs">poraba v ledgerju ✓</Badge>
                )}
              </div>
            ))}
          </div>
        </div>

        {selected.status === 'DRAFT' && (
          <div className="flex gap-2">
            <Button
              onClick={() => void completePreparation(selected.id)}
              disabled={isActing}
              className="flex-1"
            >
              {isActing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
              Zaključi pripravo (porabi sestavine)
            </Button>
            <Button
              variant="outline"
              onClick={() => void cancelPreparation(selected.id)}
              disabled={isActing}
            >
              {isActing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <XCircle className="h-4 w-4 mr-1.5" />}
              Prekliči
            </Button>
          </div>
        )}
      </div>
    )
  }

  // ──────────────── NEW FORM ────────────────
  if (showNew) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setShowNew(false)}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Nazaj na seznam
          </Button>
        </div>

        <div className="rounded-lg border p-4 space-y-4">
          {locations.length > 0 && (
            <div className="space-y-1.5">
              <Label>Lokacija (super-admin)</Label>
              <Select value={newLocationId} onValueChange={(v) => { setNewLocationId(v); void loadItems(v) }}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Izberi lokacijo" /></SelectTrigger>
                <SelectContent>
                  {locations.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Izhodni artikel (izdelek)</Label>
              <Select value={newOutputItemId} onValueChange={setNewOutputItemId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Izberi artikel" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {items.map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Proizvedena količina</Label>
              <Input
                inputMode="decimal"
                placeholder="npr. 5"
                value={newOutputQuantity}
                onChange={e => setNewOutputQuantity(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Sestavine</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setNewLines(prev => [...prev, { inventoryItemId: '', quantity: '' }])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Dodaj sestavino
              </Button>
            </div>
            {newLines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_100px_40px] gap-2 items-center">
                <Select
                  value={line.inventoryItemId}
                  onValueChange={v => setNewLines(prev => prev.map((l, i) => (i === idx ? { ...l, inventoryItemId: v } : l)))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={line.inventoryItemId ? itemLabel(line.inventoryItemId) : 'Izberi sestavino'} />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {items.map(i => (
                      <SelectItem key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit} na stanju)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  inputMode="decimal"
                  placeholder="količina"
                  value={line.quantity}
                  onChange={e => setNewLines(prev => prev.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={newLines.length === 1}
                  onClick={() => setNewLines(prev => prev.filter((_, i) => i !== idx))}
                  aria-label="Odstrani sestavino"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Opomba (neobvezno)</Label>
            <Input
              placeholder="npr. serija dnevne omake"
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              maxLength={1000}
            />
          </div>

          <Button onClick={() => void createPreparation()} disabled={isCreating} className="w-full">
            {isCreating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CookingPot className="h-4 w-4 mr-1.5" />}
            Ustvari pripravo (osnutek)
          </Button>
        </div>
      </div>
    )
  }

  // ──────────────── LIST VIEW ────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Priprava vmesnih produktov: sestavine → izdelek (sledljivo v ledgerju)
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadList()} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
            Osveži
          </Button>
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Nova priprava
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Ni še nobene priprave. Ustvarite prvo: sestavine → vmesni produkt.
        </div>
      ) : (
        <div className="rounded-lg border max-h-96 overflow-y-auto">
          {entries.map(p => {
            const meta = STATUS_META[p.status] ?? STATUS_META.DRAFT
            return (
              <button
                key={p.id}
                className="w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors"
                onClick={() => void loadDetail(p.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">
                      {p.outputItemName} · {p.outputQuantity} {p.outputUnit || 'enot'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.lineCount} sestavin · {fmtDate(p.createdAt)} · {p.createdByName || '—'}
                      {p.status === 'COMPLETED' && ` · ${fmtMoney(p.outputCostPerUnit)}/${p.outputUnit || 'enota'}`}
                    </div>
                  </div>
                  <Badge className={meta.className}>{meta.label}</Badge>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
})
