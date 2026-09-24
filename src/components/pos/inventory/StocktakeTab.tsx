'use client'

// ============================================
// TAB: INVENTURA (STOCKTAKE) — epic #115 P0-01, runda 121
// ============================================
// Fizična inventura + reconciliation: theoretical stock → physical count →
// variance → approval → adjustment → new baseline.
//  • Nova inventura: snapshot teoretičnega stanja vseh artiklov obsega
//  • Štetje (DRAFT): vnos/popravek količin = ponovno štetje
//  • Pregled (IN_REVIEW): snapshot razlike (kos × cena) → potrditev ali
//    povratek v ponovno štetje
//  • Potrditev (APPROVED): korekcije skozi zalogovni ledger — vsaka
//    neničelna razlika pusti StockTransaction (Sledljivost → Zgodovina)

import { memo, useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ClipboardList, RefreshCw, Plus, Send, CheckCircle2, Undo2, XCircle,
  ArrowLeft, Save, Loader2,
} from 'lucide-react'
import { authFetch } from '@/components/pos/pin-login/usePinAuth'

interface StocktakeLine {
  id: string
  inventoryItemId: string
  itemName: string
  unit: string
  expectedQuantity: number
  costPerUnit: number
  countedQuantity: number | null
  varianceQuantity: number | null
  varianceValue: number | null
  lineNote: string
  countedByName: string
  stockTransactionId: string | null
}

interface StocktakeEntry {
  id: string
  locationId: string
  status: string // DRAFT | IN_REVIEW | APPROVED | CANCELLED
  note: string
  createdByName: string
  approvedByName: string
  submittedAt: string | null
  approvedAt: string | null
  cancelledAt: string | null
  recountCount: number
  lineCount: number
  countedCount: number
  snapshotVarianceValue: number
  createdAt: string
  lines?: StocktakeLine[]
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Priprava', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  IN_REVIEW: { label: 'Pregled', className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200' },
  APPROVED: { label: 'Potrjeno', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
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

interface LocationPickItem {
  id: string
  name: string
}

export const StocktakeTab = memo(function StocktakeTab() {
  const [entries, setEntries] = useState<StocktakeEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selected, setSelected] = useState<StocktakeEntry | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [newNote, setNewNote] = useState('')
  // MODEL A: super-admin brez lokacije MORA podati izrecen locationId
  // (fail-closed 400) — pariteta z WasteRecordDialog (R119). /api/locations je
  // scoped: vezan user vidi točno svojo (brez izbirnika), super-admin vse → izbira.
  const [locations, setLocations] = useState<LocationPickItem[]>([])
  const [newLocationId, setNewLocationId] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  // local count edits (DRAFT): lineId → counted value (string za input UX)
  const [countEdits, setCountEdits] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  const loadList = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await authFetch('/api/stocktakes')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Napaka pri nalaganju inventur')
      }
      const data = await res.json()
      setEntries(Array.isArray(data.entries) ? data.entries : [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Napaka pri nalaganju inventur')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await authFetch(`/api/stocktakes/${id}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Napaka pri nalaganju inventure')
      }
      const data = await res.json()
      setSelected(data.stocktake)
      // seed local edits z obstoječimi štetji
      const edits: Record<string, string> = {}
      for (const l of data.stocktake.lines ?? []) {
        if (l.countedQuantity !== null && l.countedQuantity !== undefined) {
          edits[l.id] = String(l.countedQuantity)
        }
      }
      setCountEdits(edits)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Napaka pri nalaganju inventure')
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

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (showNew) {
      void loadLocations()
      setNewLocationId('')
    }
  }, [showNew, loadLocations])

  const createStocktake = useCallback(async () => {
    setIsCreating(true)
    try {
      const res = await authFetch('/api/stocktakes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: newNote,
          ...(newLocationId ? { locationId: newLocationId } : {}),
          idempotencyKey: `st-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Napaka pri ustvarjanju inventure')
      toast.success('Inventura ustvarjena — začnite šteti')
      setShowNew(false)
      setNewNote('')
      await loadList()
      if (data.stocktake?.id) await loadDetail(data.stocktake.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Napaka pri ustvarjanju inventure')
    } finally {
      setIsCreating(false)
    }
  }, [newNote, newLocationId, loadList, loadDetail])

  const saveCounts = useCallback(async () => {
    if (!selected) return
    const counts = Object.entries(countEdits).map(([lineId, v]) => {
      const n = Number(v.replace(',', '.'))
      return { lineId, countedQuantity: Number.isFinite(n) ? n : -1 }
    })
    if (counts.length === 0) {
      toast.error('Vnesite vsaj eno količino')
      return
    }
    setIsSaving(true)
    try {
      const res = await authFetch(`/api/stocktakes/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counts }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Napaka pri shranjevanju štetja')
      toast.success('Štetje shranjeno')
      await loadDetail(selected.id)
      await loadList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Napaka pri shranjevanju štetja')
    } finally {
      setIsSaving(false)
    }
  }, [selected, countEdits, loadDetail, loadList])

  const action = useCallback(async (verb: 'submit' | 'approve' | 'recount' | 'cancel') => {
    if (!selected) return
    setIsSaving(true)
    try {
      const res = await authFetch(`/api/stocktakes/${selected.id}/${verb}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Napaka pri akciji')
      const okMsg: Record<string, string> = {
        submit: 'Oddano v pregled',
        approve: 'Inventura potrjena — zaloge popravljene',
        recount: 'Vrnjeno v ponovno štetje',
        cancel: 'Inventura preklicana',
      }
      toast.success(okMsg[verb])
      await loadDetail(selected.id)
      await loadList()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Napaka pri akciji')
    } finally {
      setIsSaving(false)
    }
  }, [selected, loadDetail, loadList])

  // ── DETAIL VIEW ──
  if (selected) {
    const statusMeta = STATUS_META[selected.status] ?? STATUS_META.DRAFT
    const isDraft = selected.status === 'DRAFT'
    const snapshotVariance = (selected.lines ?? []).reduce(
      (s, l) => s + (l.varianceValue ?? 0), 0,
    )
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setSelected(null); void loadList() }}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Seznam
          </Button>
          <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
          {selected.recountCount > 0 && (
            <span className="text-xs text-muted-foreground">Ponovna štetja: {selected.recountCount}</span>
          )}
          <span className="text-xs text-muted-foreground">
            {fmtDate(selected.createdAt)} · ustvaril {selected.createdByName || '—'}
          </span>
        </div>
        {selected.note && <p className="text-sm text-muted-foreground">{selected.note}</p>}

        <div className="rounded-lg border p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Vrstice / preštete</p>
            <p className="font-medium">{selected.lineCount} / {selected.countedCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Razlika (pregledna vrednost)</p>
            <p className={`font-medium ${snapshotVariance < 0 ? 'text-red-600' : snapshotVariance > 0 ? 'text-emerald-600' : ''}`}>
              {fmtMoney(Math.round(snapshotVariance * 100) / 100)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Potrdil / potrjeno</p>
            <p className="font-medium">{selected.approvedByName || '—'} · {fmtDate(selected.approvedAt)}</p>
          </div>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Artikel</th>
                  <th className="px-3 py-2 font-medium text-right">Teorija</th>
                  <th className="px-3 py-2 font-medium text-right">Štetje</th>
                  <th className="px-3 py-2 font-medium text-right">Razlika</th>
                  <th className="px-3 py-2 font-medium text-right">Vrednost</th>
                </tr>
              </thead>
              <tbody>
                {(selected.lines ?? []).map(l => {
                  const v = l.varianceQuantity
                  const vv = l.varianceValue
                  return (
                    <tr key={l.id} className="border-t">
                      <td className="px-3 py-2">
                        {l.itemName}
                        <span className="text-muted-foreground"> · {l.unit}</span>
                        {l.lineNote && <p className="text-xs text-muted-foreground">{l.lineNote}</p>}
                        {l.stockTransactionId && (
                          <p className="text-xs text-emerald-600">korekcija v ledgerju ✓</p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.expectedQuantity}</td>
                      <td className="px-3 py-2 text-right">
                        {isDraft ? (
                          <Input
                            className="w-24 h-8 text-right ml-auto"
                            inputMode="decimal"
                            aria-label={`Štetje za ${l.itemName}`}
                            value={countEdits[l.id] ?? ''}
                            placeholder="—"
                            onChange={e => setCountEdits(prev => ({ ...prev, [l.id]: e.target.value }))}
                          />
                        ) : (
                          <span className="tabular-nums">{l.countedQuantity ?? '—'}</span>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums ${(v ?? 0) < 0 ? 'text-red-600' : (v ?? 0) > 0 ? 'text-emerald-600' : ''}`}>
                        {v === null ? '—' : `${v > 0 ? '+' : ''}${v}`}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums ${(vv ?? 0) < 0 ? 'text-red-600' : (vv ?? 0) > 0 ? 'text-emerald-600' : ''}`}>
                        {vv === null ? '—' : fmtMoney(vv)}
                      </td>
                    </tr>
                  )
                })}
                {(selected.lines ?? []).length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Ni vrstic</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <>
              <Button size="sm" onClick={() => void saveCounts()} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Shrani štetje
              </Button>
              <Button size="sm" variant="outline" onClick={() => void action('submit')} disabled={isSaving || selected.countedCount === 0}>
                <Send className="h-4 w-4 mr-1" /> Oddaj v pregled
              </Button>
              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => void action('cancel')} disabled={isSaving}>
                <XCircle className="h-4 w-4 mr-1" /> Prekliči
              </Button>
            </>
          )}
          {selected.status === 'IN_REVIEW' && (
            <>
              <Button size="sm" onClick={() => void action('approve')} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Potrdi (popravi zaloge)
              </Button>
              <Button size="sm" variant="outline" onClick={() => void action('recount')} disabled={isSaving}>
                <Undo2 className="h-4 w-4 mr-1" /> Vrni v ponovno štetje
              </Button>
              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => void action('cancel')} disabled={isSaving}>
                <XCircle className="h-4 w-4 mr-1" /> Prekliči
              </Button>
            </>
          )}
        </div>
        {isDraft && selected.countedCount === 0 && (
          <p className="text-xs text-muted-foreground">Vnesite vsaj eno količino za oddajo v pregled.</p>
        )}
      </div>
    )
  }

  // ── LIST VIEW ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Fizična inventura: teorija → štetje → razlika → potrditev → popravljene zaloge (sledljivo v ledgerju).
        </p>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => void loadList()} aria-label="Osveži inventure">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova inventura
          </Button>
        </div>
      </div>

      {showNew && (
        <div className="rounded-lg border p-4 space-y-3">
          {locations.length > 1 && (
            <div className="space-y-1.5">
              <Label>Lokacija (obvezna za admin)</Label>
              <Select value={newLocationId} onValueChange={setNewLocationId}>
                <SelectTrigger aria-label="Lokacija inventure" className="w-full sm:w-72">
                  <SelectValue placeholder="Izberite lokacijo …" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="stocktake-note">Opomba (opcijsko)</Label>
            <Input
              id="stocktake-note"
              placeholder="npr. Mesečna inventura skladišča"
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              maxLength={1000}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Ustvari se seznam vseh artiklov te lokacije s trenutnim (teoretičnim) stanjem. Štetje se vnese per artikel.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => void createStocktake()}
              disabled={isCreating || (locations.length > 1 && newLocationId === '')}
            >
              {isCreating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Ustvari
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}>Prekliči</Button>
          </div>
        </div>
      )}

      {entries.length === 0 && !isLoading && !showNew && (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Ni še nobene inventure</p>
          <p className="text-sm">Ustvarite novo inventuro in preštejte zaloge.</p>
        </div>
      )}

      {entries.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Datum</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Opomba</th>
                  <th className="px-3 py-2 font-medium text-right">Preštete</th>
                  <th className="px-3 py-2 font-medium text-right">Razlika</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {entries.map(e => {
                  const meta = STATUS_META[e.status] ?? STATUS_META.DRAFT
                  return (
                    <tr key={e.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDate(e.createdAt)}</td>
                      <td className="px-3 py-2"><Badge className={meta.className}>{meta.label}</Badge></td>
                      <td className="px-3 py-2 max-w-48 truncate">{e.note || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{e.countedCount}/{e.lineCount}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${e.snapshotVarianceValue < 0 ? 'text-red-600' : e.snapshotVarianceValue > 0 ? 'text-emerald-600' : ''}`}>
                        {fmtMoney(e.snapshotVarianceValue)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="outline" size="sm" onClick={() => void loadDetail(e.id)}>
                          Odpri
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
})
