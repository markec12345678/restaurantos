'use client'

// ============================================
// TAB: SERIJE (BATCH / LOT / EXPIRY) — epic #115 §4, runda 120
// ============================================
// Sledljivost serij: supplier → prevzem → batch → poraba/odpad.
// Opozorila §4: expiry soon (≤ 7 dni) · expired · izčrpane serije.
// Low stock / stockout risk ostajata na Pregled (dashboard) — item nivo.

import { memo, useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PackageSearch, RefreshCw, AlertTriangle, CalendarClock, CheckCircle2, XCircle } from 'lucide-react'
import { authFetch } from '@/components/pos/pin-login/usePinAuth'

interface BatchRow {
  id: string
  inventoryItemId: string
  itemName: string
  itemUnit: string
  locationId: string | null
  lotNumber: string
  supplierName: string
  receivedAt: string
  expiryDate: string | null
  quantityInitial: number
  quantityRemaining: number
  unitCost: number | null
  status: string
  daysToExpiry: number | null
  isExpired: boolean
  isExpiringSoon: boolean
}

interface BatchesSummary {
  total: number
  active: number
  exhausted: number
  expired: number
  expiringSoon: number
  expiringSoonDays: number
}

type FilterKey = 'all' | 'expiring' | 'expired' | 'exhausted'

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'Vse' },
  { key: 'expiring', label: 'Uskoro preteče' },
  { key: 'expired', label: 'Pretečeno' },
  { key: 'exhausted', label: 'Izčrpane' },
]

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('sl-SI')
}

export const BatchesTab = memo(function BatchesTab() {
  const [batches, setBatches] = useState<BatchRow[]>([])
  const [summary, setSummary] = useState<BatchesSummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [lotSearch, setLotSearch] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await authFetch('/api/inventory/batches')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Napaka pri nalaganju serij')
      }
      const data = await res.json()
      setBatches(Array.isArray(data.batches) ? data.batches : [])
      setSummary(data.summary ?? null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Napaka pri nalaganju serij')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = batches.filter((b) => {
    if (lotSearch.trim() && !b.lotNumber.toLowerCase().includes(lotSearch.trim().toLowerCase())) return false
    if (filter === 'expiring') return b.isExpiringSoon
    if (filter === 'expired') return b.isExpired && b.status === 'ACTIVE'
    if (filter === 'exhausted') return b.status === 'EXHAUSTED'
    return true
  })

  return (
    <div className="space-y-4" data-testid="batches-tab">
      {/* Opozorila §4 (realni podatki) */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => setFilter('expired')}
            className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-colors ${summary.expired > 0 ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40' : 'border-border'}`}
            aria-label={`Pretečene serije: ${summary.expired}`}
          >
            <XCircle className="h-4 w-4 text-red-600 shrink-0" />
            <div>
              <p className="text-lg font-semibold leading-none">{summary.expired}</p>
              <p className="text-xs text-muted-foreground mt-1">Pretečeno</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setFilter('expiring')}
            className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-colors ${summary.expiringSoon > 0 ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40' : 'border-border'}`}
            aria-label={`Uskoro preteče (≤ ${summary.expiringSoonDays} dni): ${summary.expiringSoon}`}
          >
            <CalendarClock className="h-4 w-4 text-amber-600 shrink-0" />
            <div>
              <p className="text-lg font-semibold leading-none">{summary.expiringSoon}</p>
              <p className="text-xs text-muted-foreground mt-1">Uskoro preteče (≤ {summary.expiringSoonDays} dni)</p>
            </div>
          </button>
          <div className="flex items-center gap-2 rounded-lg border border-border p-3">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <div>
              <p className="text-lg font-semibold leading-none">{summary.active}</p>
              <p className="text-xs text-muted-foreground mt-1">Aktivne serije</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border p-3">
            <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-lg font-semibold leading-none">{summary.exhausted}</p>
              <p className="text-xs text-muted-foreground mt-1">Izčrpane</p>
            </div>
          </div>
        </div>
      )}

      {/* Filtri + iskanje */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? 'default' : 'outline'}
            onClick={() => setFilter(f.key)}
            className="min-h-[36px]"
          >
            {f.label}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <div>
            <Label htmlFor="batch-lot-search" className="sr-only">Išči po lot številki</Label>
            <Input
              id="batch-lot-search"
              placeholder="Išči lot…"
              value={lotSearch}
              onChange={(e) => setLotSearch(e.target.value)}
              className="w-40 h-9"
              aria-label="Išči po lot številki"
            />
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={isLoading} className="min-h-[36px]" aria-label="Osveži serije">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Seznam serij */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <PackageSearch className="mx-auto h-8 w-8 mb-2 opacity-40" />
          {isLoading
            ? 'Nalagam serije…'
            : 'Ni serij za prikaz. Serija se ustvari ob prevzemu (Vnos nabave → Lot št.).'}
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="p-2 font-medium">Artikel</th>
                  <th className="p-2 font-medium">Lot</th>
                  <th className="p-2 font-medium hidden md:table-cell">Dobavitelj</th>
                  <th className="p-2 font-medium hidden sm:table-cell">Prejeto</th>
                  <th className="p-2 font-medium">Rok uporabe</th>
                  <th className="p-2 font-medium text-right">Preostanek</th>
                  <th className="p-2 font-medium text-right hidden md:table-cell">Cena/en</th>
                  <th className="p-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className="border-t hover:bg-muted/30" data-testid="batch-row" data-lot={b.lotNumber}>
                    <td className="p-2 font-medium">{b.itemName}</td>
                    <td className="p-2 font-mono text-xs">{b.lotNumber}</td>
                    <td className="p-2 hidden md:table-cell">{b.supplierName || '—'}</td>
                    <td className="p-2 hidden sm:table-cell">{fmtDate(b.receivedAt)}</td>
                    <td className="p-2">
                      {b.expiryDate ? (
                        <span className="inline-flex items-center gap-1">
                          {fmtDate(b.expiryDate)}
                          {b.isExpired ? (
                            <Badge variant="destructive" className="text-[10px] px-1">pretečeno</Badge>
                          ) : b.isExpiringSoon ? (
                            <Badge className="bg-amber-500 hover:bg-amber-500 text-[10px] px-1">≤ {b.daysToExpiry} dni</Badge>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {b.quantityRemaining} / {b.quantityInitial} {b.itemUnit}
                    </td>
                    <td className="p-2 text-right tabular-nums hidden md:table-cell">
                      {b.unitCost != null ? `${b.unitCost.toFixed(2)} €` : '—'}
                    </td>
                    <td className="p-2">
                      {b.status === 'ACTIVE' ? (
                        <Badge variant="outline" className="text-[10px]">aktiven</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">izčrpan</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Poraba in odpad se po serijah razporedita FEFO — First Expired, First Out (najprej najkrajši rok uporabe).
        Sledljivost: prevzem → serija → poraba/odpad (zalogovni ledger).
      </p>
    </div>
  )
})
