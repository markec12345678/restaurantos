'use client'

// ============================================
// OFFLINE QUEUE DASHBOARD — admin pregled konfliktov
// ============================================
// P1-15/P1-16 (uporabniška zahteva): toast obvestila ob SYNC_CONFLICT
// obstajajo — TA panel je logični nadaljevanek: sistematičen pregled
// vseh vnosov offline vrste, ki čakajo ROČNO odločitev.
//
// VAJETNO: offline vrsta živi v IndexedDB NA NAPRAVI (browser), ne na
// strežniku. Panel prikazuje vnose NAPRAVE, na kateri je odprt —
// konflikt zapisujeta Service Worker / page sync (P1-14 format:
// operationId, idempotencyKey, deviceId, employeeId, createdAt,
// payloadVersion, retryCount, status, lastError).
//
// Akcije:
//   - PONOVNO POŠLJI (syncSingleOrder) — enak kanal + idempotencyKey
//   - ODPUSTI (dequeue + razlog) — po potrditvi, z audit zapisom na
//     strežniku (če je online; offline = samo lokalni discard)
// ============================================

import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  AlertTriangle, CheckCircle2, Clock, CloudOff, FileSearch, Loader2,
  RefreshCw, Send, Smartphone, Trash2, Wifi, WifiOff, XCircle,
} from 'lucide-react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import {
  syncSingleOrder,
  dequeueOrder,
  isOnline,
  type PendingOrder,
  type OfflineOpStatus,
} from '@/lib/offline-orders'
import {
  useOfflineQueueEntries,
  useOfflineQueueStats,
  useInvalidateOfflineQueue,
} from './useOfflineQueue'

// --- Status config ---
interface StatusCfg {
  label: string
  color: string
  icon: typeof Clock
}

const statusConfig: Record<OfflineOpStatus, StatusCfg> = {
  PENDING: { label: 'Čaka', color: 'bg-blue-50 text-blue-800 border-blue-200', icon: Clock },
  PROCESSING: { label: 'V obdelavi', color: 'bg-blue-50 text-blue-800 border-blue-200', icon: Loader2 },
  SYNCED: { label: 'Sinhronizirano', color: 'bg-green-50 text-green-800 border-green-200', icon: CheckCircle2 },
  RETRY: { label: 'Ponovni poskus', color: 'bg-amber-50 text-amber-800 border-amber-200', icon: RefreshCw },
  FAILED: { label: 'Neuspešno', color: 'bg-red-50 text-red-800 border-red-200', icon: XCircle },
  CONFLICT: { label: 'Konflikt', color: 'bg-red-50 text-red-800 border-red-300', icon: AlertTriangle },
  MANUAL_REVIEW: { label: 'Ročni pregled', color: 'bg-orange-50 text-orange-800 border-orange-200', icon: FileSearch },
  EXPIRED: { label: 'Poteklo', color: 'bg-gray-100 text-gray-600 border-gray-300', icon: Clock },
}

type FilterValue = 'review' | 'all' | OfflineOpStatus

const filterOptions: Array<{ value: FilterValue; label: string }> = [
  { value: 'review', label: 'Za pregled' },
  { value: 'CONFLICT', label: 'Konflikti' },
  { value: 'MANUAL_REVIEW', label: 'Ročni pregled' },
  { value: 'PENDING', label: 'Čakajoča' },
  { value: 'FAILED', label: 'Neuspešna' },
  { value: 'all', label: 'Vse' },
]

function matchesFilter(entry: PendingOrder, filter: FilterValue): boolean {
  if (filter === 'all') return true
  if (filter === 'review') {
    return entry.status === 'CONFLICT' || entry.status === 'MANUAL_REVIEW' ||
      entry.status === 'FAILED' || entry.status === 'EXPIRED'
  }
  return entry.status === filter
}

function itemCount(entry: PendingOrder): number {
  return entry.orderData?.orderItems?.length ?? 0
}

function totalQuantity(entry: PendingOrder): number {
  return (entry.orderData?.orderItems ?? []).reduce((sum, i) => sum + (i.quantity || 0), 0)
}

export function OfflineQueueDashboard() {
  const [filter, setFilter] = useState<FilterValue>('review')
  const [detail, setDetail] = useState<PendingOrder | null>(null)
  const [discardDialog, setDiscardDialog] = useState<PendingOrder | null>(null)
  const [discardReason, setDiscardReason] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const invalidate = useInvalidateOfflineQueue()

  const entriesQuery = useOfflineQueueEntries()
  const statsQuery = useOfflineQueueStats()

  const entries = entriesQuery.data ?? []
  const stats = statsQuery.data

  const filtered = useMemo(() => entries.filter(e => matchesFilter(e, filter)), [entries, filter])

  const reviewCount = (stats?.CONFLICT ?? 0) + (stats?.MANUAL_REVIEW ?? 0)
  const online = typeof navigator !== 'undefined' ? isOnline() : true

  // ── Akcija: ponovna sinhronizacija enega vnosa ──
  async function handleRetry(entry: PendingOrder) {
    setBusyId(entry.id)
    try {
      const result = await syncSingleOrder(entry.id, authFetch)
      if (result.ok) {
        toast.success(`Naročilo ${entry.orderData?.customerName || entry.id} sinhronizirano`)
      } else {
        toast.error(`Ponovna poskus ni uspel: ${result.message}`)
      }
    } catch {
      toast.error('Napaka pri ponovnem pošiljanju')
    } finally {
      setBusyId(null)
      invalidate()
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
    }
  }

  // ── Akcija: odpusti vnos (po pregledu) ──
  async function handleDiscard() {
    if (!discardDialog) return
    const entry = discardDialog
    setBusyId(entry.id)
    try {
      const removed = await dequeueOrder(entry.id)
      if (!removed) {
        toast.error('Vnosa ni bilo mogoče odstraniti')
        return
      }
      // Audit zapis na strežniku (best-effort — offline discard je tudi OK,
      // ker IndexedDB vnos ne obstaja več in retencija NE počisti konfliktov
      // pred 30 dnevi)
      if (online) {
        authFetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'OFFLINE_QUEUE_DISCARD',
            entityType: 'OfflineQueueEntry',
            entityId: entry.id,
            details: JSON.stringify({
              operationId: entry.operationId,
              idempotencyKey: entry.idempotencyKey,
              status: entry.status,
              lastError: entry.lastError,
              reason: discardReason || 'Ni razloga',
              itemCount: itemCount(entry),
            }),
          }),
        }).catch(() => {
          // Audit ni kritičen za discard — tiho nadaljuj
        })
      }
      toast.success(`Vnos odstranjen iz vrste${discardReason ? ` (${discardReason})` : ''}`)
      setDiscardDialog(null)
      setDiscardReason('')
      setDetail(null)
    } finally {
      setBusyId(null)
      invalidate()
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CloudOff className="h-6 w-6 text-primary" />
            Offline vrsta — konflikti in pregled
          </h2>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
            <Smartphone className="h-3.5 w-3.5" />
            Vnosi te NAPRAVE (IndexedDB) — naročila, ustvarjena brez povezave
            {online
              ? <span className="inline-flex items-center gap-1 text-green-600"><Wifi className="h-3.5 w-3.5" /> online</span>
              : <span className="inline-flex items-center gap-1 text-red-600"><WifiOff className="h-3.5 w-3.5" /> offline</span>}
          </p>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={() => { entriesQuery.refetch(); statsQuery.refetch() }}
          disabled={entriesQuery.isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${entriesQuery.isFetching ? 'animate-spin' : ''}`} />
          Osveži
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard title="Za pregled" value={reviewCount} icon={AlertTriangle} color="bg-red-50 border-red-200 text-red-800" alert={reviewCount > 0} />
        <StatCard title="Čakajoča" value={stats?.PENDING ?? 0} icon={Clock} color="bg-blue-50 border-blue-200 text-blue-800" />
        <StatCard title="Ponovni poskusi" value={stats?.RETRY ?? 0} icon={RefreshCw} color="bg-amber-50 border-amber-200 text-amber-800" />
        <StatCard title="Neuspešna" value={stats?.FAILED ?? 0} icon={XCircle} color="bg-gray-50 border-gray-200 text-gray-700" />
        <StatCard title="Potekla" value={stats?.EXPIRED ?? 0} icon={Clock} color="bg-gray-50 border-gray-200 text-gray-500" />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Filter:</span>
        {filterOptions.map((opt) => {
          const count = opt.value === 'review'
            ? entries.filter(e => matchesFilter(e, 'review')).length
            : opt.value === 'all' ? entries.length : entries.filter(e => e.status === opt.value).length
          return (
            <Button
              key={opt.value}
              variant={filter === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(opt.value)}
            >
              {opt.label}
              <Badge variant="secondary" className="ml-2">{count}</Badge>
            </Button>
          )
        })}
      </div>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudOff className="h-5 w-5" />
            Vnosi ({filtered.length})
            {reviewCount > 0 && (
              <Badge className="bg-red-100 text-red-800 border-red-300">
                {reviewCount} zahteva pozornost
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entriesQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              {filter === 'review'
                ? 'Ni vnosov, ki bi čakali ročni pregled — vrsta je čista.'
                : 'Ni vnosov za izbrani filter.'}
            </div>
          ) : (
            <ScrollArea className="h-[480px] pr-4">
              <div className="space-y-3">
                {filtered.map((entry) => {
                  const cfg = statusConfig[entry.status]
                  const StatusIcon = cfg.icon
                  const busy = busyId === entry.id
                  return (
                    <div
                      key={entry.id}
                      className="border rounded-lg p-4 space-y-2.5 hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.color}`}>
                            <StatusIcon className={`h-3.5 w-3.5 ${entry.status === 'PROCESSING' ? 'animate-spin' : ''}`} />
                            {cfg.label}
                          </span>
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">
                              {entry.orderData?.customerName || 'Naročilo'}
                              <span className="text-muted-foreground font-normal">
                                {' · '}{itemCount(entry)} postavk · {totalQuantity(entry)} kos
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {format(entry.createdAt, 'dd.MM.yyyy HH:mm:ss')}
                              {entry.orderData?.tableId ? ` · miza ${entry.orderData.tableId}` : ''}
                              {` · poskusi: ${entry.retryCount}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm" variant="outline"
                            onClick={() => setDetail(entry)}
                          >
                            <FileSearch className="h-4 w-4 mr-1" />
                            Podrobnosti
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            onClick={() => handleRetry(entry)}
                            disabled={busy || entry.status === 'PENDING'}
                            title={entry.status === 'PENDING' ? 'Čaka na samodejno sinhronizacijo' : 'Ponovno pošlji na strežnik'}
                          >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => { setDiscardDialog(entry); setDiscardReason('') }}
                            disabled={busy}
                            title="Odstrani vnos po pregledu"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {entry.lastError && (
                        <div className="text-xs bg-red-50 border border-red-200 text-red-700 rounded px-2.5 py-1.5 font-mono break-all">
                          {entry.lastError}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {(() => {
                    const cfg = statusConfig[detail.status]
                    const Icon = cfg.icon
                    return <><Icon className="h-5 w-5" /> {cfg.label} — {detail.orderData?.customerName || 'Naročilo'}</>
                  })()}
                </DialogTitle>
                <DialogDescription>
                  P1-14 metapodatki vnosa + payload (vsebina naročila)
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Metadata grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <MetaRow label="operationId" value={detail.operationId} mono />
                  <MetaRow label="idempotencyKey" value={detail.idempotencyKey} mono />
                  <MetaRow label="deviceId" value={detail.deviceId} mono />
                  <MetaRow label="Ustvarjeno" value={format(detail.createdAt, 'dd.MM.yyyy HH:mm:ss')} />
                  <MetaRow label="Zaposleni (ID)" value={detail.employeeId ?? '—'} mono />
                  <MetaRow label="Lokacija (ID)" value={detail.locationId ?? '— (server resolva)'} mono />
                  <MetaRow label="payloadVersion" value={String(detail.payloadVersion)} />
                  <MetaRow label="Poskusi / retryCount" value={String(detail.retryCount)} />
                  {detail.lastError && (
                    <div className="col-span-2">
                      <MetaRow label="Zadnja napaka" value={detail.lastError} mono />
                    </div>
                  )}
                </div>

                {/* Order payload */}
                <div>
                  <Label className="text-sm font-medium">Vsebina naročila (payload)</Label>
                  <div className="mt-1.5 rounded border bg-muted/50 p-3 text-xs font-mono whitespace-pre overflow-x-auto max-h-64 overflow-y-auto">
                    {JSON.stringify(detail.orderData, null, 2)}
                  </div>
                </div>

                {detail.syncedOrderId && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Uspešno sinhronizirano kot:</span>{' '}
                    <span className="font-mono">{detail.syncedOrderId}</span>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleRetry(detail)}
                  disabled={busyId === detail.id || detail.status === 'PENDING'}
                >
                  {busyId === detail.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                  Ponovno pošlji
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => { setDiscardDialog(detail); setDiscardReason('') }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Odpusti
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Discard confirmation */}
      <Dialog open={!!discardDialog} onOpenChange={(open) => !open && setDiscardDialog(null)}>
        <DialogContent className="max-w-md">
          {discardDialog && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Odpusti vnos iz offline vrste?
                </DialogTitle>
                <DialogDescription>
                  Vnos <span className="font-mono text-xs">{discardDialog.operationId}</span>
                  {' '}({statusConfig[discardDialog.status].label.toLowerCase()})
                  {' '}z {itemCount(discardDialog)} postavkami bo trajno odstranjen.
                  Dejanje se zapiše v revizijski dnevnik.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="discard-reason">Razlog odpusta (za revizijsko sled)</Label>
                <Textarea
                  id="discard-reason"
                  value={discardReason}
                  onChange={(e) => setDiscardReason(e.target.value)}
                  placeholder="npr. Naročilo je bilo vnešeno ročno prek POS / stranka je odnehala / podvojen vnos ..."
                  rows={3}
                />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDiscardDialog(null)}>Prekliči</Button>
                <Button variant="destructive" onClick={handleDiscard} disabled={busyId === discardDialog.id}>
                  {busyId === discardDialog.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                  Trajno odpusti
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// --- Pomožne komponente ---

function StatCard({ title, value, icon: Icon, color, alert }: {
  title: string
  value: number
  icon: typeof Clock
  color: string
  alert?: boolean
}) {
  return (
    <div className={`rounded-lg border p-3 flex items-center gap-3 ${color} ${alert ? 'ring-2 ring-red-300' : ''}`}>
      <Icon className="h-6 w-6 shrink-0" />
      <div className="min-w-0">
        <div className="text-2xl font-bold leading-none">{value}</div>
        <div className="text-xs opacity-80 mt-0.5">{title}</div>
      </div>
    </div>
  )
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-sm break-all ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}

export default OfflineQueueDashboard
