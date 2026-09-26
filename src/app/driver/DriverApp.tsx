'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bike, LogOut, MapPin, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorBoundary } from '@/components/error-boundary'
import { Button } from '@/components/ui/button'
import { DeliveryCard } from './DeliveryCard'
import { DeliverDialog } from './DeliverDialog'
import type { DeliverDialogResult } from './DeliverDialog'
import { UnauthorizedError, authPostJson, extractErrorMessage } from './driver-context'
import { isCashOnDelivery, orderTotal, useDriverAssignments } from './useDriverAssignments'
import type { ActiveDriverStatus, MineDelivery, ReadyDelivery } from './useDriverAssignments'
import { useDriverLocation } from './useDriverLocation'
import { useDriverWs } from './useDriverWs'
import type { GpsState } from './useDriverLocation'

// =====================================================================
// DriverApp — glavni voznikov zaslon (R137-c, epic #115 P1-13).
// Mobilni prvi: en stolpec max-w-md, veliki touch cilji (min-h-11/12).
// Deluje standalone (/driver) in kot POS modul (module-registry 'driver').
//
// Statusni prehodi (strežniški CAS — UI samo prikaže 409 in osveži):
//   assigned → Prevzel sem (picked_up) → Na poti (on_the_way) →
//   Prihajam (arriving) → Dostavljeno (delivered, dialog) | Težava (failed, dialog)
// Self-claim (ready[]): POST BREZ driverName — server uporabi sejo zaposlenega.
// GPS (R138): useDriverLocation pošilja pozicijo med aktivno dostavo
// (permission šele ob claimu, POST samo ob vidnem zaslonu, 30 s throttle);
// dispečer vidi pozicijo prek DeliveryTracker (GET /api/delivery-tracking).
// =====================================================================

/** Naslednji prehod po trenutnem statusu (undefined = ni primarnega gumba) */
const NEXT_STATUS: Record<ActiveDriverStatus, { label: string; next: 'picked_up' | 'on_the_way' | 'arriving' }> = {
  assigned: { label: 'Prevzel sem', next: 'picked_up' },
  picked_up: { label: 'Na poti', next: 'on_the_way' },
  on_the_way: { label: 'Prihajam', next: 'arriving' },
  arriving: { label: 'Dostavljeno', next: 'arriving' }, // next ignoriran — odpre dialog
}

const TROUBLE_STATUSES: readonly ActiveDriverStatus[] = ['assigned', 'picked_up', 'on_the_way', 'arriving']

interface DriverAppProps {
  /** standalone page: ob poteku seje (401) preklopi na prijavni zaslon */
  onLogout?: () => void
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
      {text}
    </div>
  )
}

/** GPS indikator: statični razredi (BUG-04 kanon) + slovenski opis stanja */
const GPS_INDICATOR: Record<GpsState, { dot: string; label: string } | null> = {
  idle: null,
  requesting: { dot: 'bg-amber-400 animate-pulse', label: 'Lokacija: pridobivanje …' },
  granted: { dot: 'bg-emerald-500', label: 'Lokacija: deluje' },
  denied: { dot: 'bg-muted-foreground/40', label: 'Lokacija: izklopljena v brskalniku' },
  unavailable: { dot: 'bg-muted-foreground/40', label: 'Lokacija ni na voljo' },
}

export function DriverApp({ onLogout }: DriverAppProps) {
  const { mine, ready, timestamp, connected, isLoading, loggedOut, refresh } = useDriverAssignments()
  const { gpsState } = useDriverLocation(mine, !loggedOut)
  const gps = GPS_INDICATOR[gpsState]
  // R139: WS push — ob DELIVERY_UPDATED / NEW_ORDER(delivery) takojšen refetch
  // prek refresh() (fetchSeq dedupe prepreči podvojene tike). Poll 15 s ostane
  // nespremenjen kot fallback; v devu (next dev) se WS ne povezuje
  // (produkciski-only — runda 12 kanon).
  useDriverWs({ onSignal: refresh, enabled: !loggedOut })

  // Akcije v teku — per-dostava loading (idempotentni self-claim: gumb disable med klicem)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [advancingId, setAdvancingId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{ delivery: MineDelivery; mode: 'delivered' | 'failed' } | null>(null)
  const [dialogBusy, setDialogBusy] = useState(false)
  const [dialogError, setDialogError] = useState('')

  // 401 med pollom → standalone page preklopi na prijavo
  useEffect(() => {
    if (loggedOut && onLogout) onLogout()
  }, [loggedOut, onLogout])

  const timeLabel = useMemo(() => {
    if (!timestamp) return '—'
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }, [timestamp])

  /** Skupni POST na /api/delivery-tracking: 409 → toast + refresh (CAS kanon) */
  const postTracking = useCallback(
    async (body: Record<string, unknown>): Promise<boolean> => {
      try {
        const res = await authPostJson('/api/delivery-tracking', body)
        if (res.ok) return true
        const data: unknown = await res.json().catch(() => null)
        if (res.status === 409) {
          // 409 = stale (nekdo je že spremenil) ALI duplikat self-claim —
          // elegantno: toast + osveži seznam, ne katastrofa
          toast.info('Stanje je spremenjeno — osveženo')
          void refresh()
          return false
        }
        toast.error(extractErrorMessage(data, `Napaka ${res.status}`))
        return false
      } catch (err) {
        // UnauthorizedError počisti žeton — hook ob naslednjem pollu preklopi na prijavo
        if (!(err instanceof UnauthorizedError)) toast.error('Povezava ni na voljo')
        return false
      }
    },
    [refresh],
  )

  /** Self-claim iz "Za prevzem": { deliveryInfoId } — BREZ driverName (session employee) */
  const handleClaim = useCallback(
    async (delivery: ReadyDelivery) => {
      if (claimingId) return // en claim na enkrat (idempotenca UI)
      setClaimingId(delivery.id)
      const ok = await postTracking({ deliveryInfoId: delivery.id })
      setClaimingId(null)
      if (ok) {
        toast.success('Dostava prevzeta')
        void refresh()
      }
    },
    [claimingId, postTracking, refresh],
  )

  /** Statusni prehod mine[] (picked_up / on_the_way / arriving) */
  const handleAdvance = useCallback(
    async (delivery: MineDelivery, next: 'picked_up' | 'on_the_way' | 'arriving') => {
      if (advancingId) return
      setAdvancingId(delivery.deliveryInfoId)
      const ok = await postTracking({ deliveryInfoId: delivery.deliveryInfoId, status: next })
      setAdvancingId(null)
      if (ok) void refresh()
    },
    [advancingId, postTracking, refresh],
  )

  /** Dialog potrdil delivered/failed (podNotes + cashCollected) */
  const handleDialogSubmit = useCallback(
    async ({ podNotes, cashCollected }: DeliverDialogResult) => {
      if (!dialog || dialogBusy) return
      setDialogBusy(true)
      setDialogError('')
      const body: Record<string, unknown> = {
        deliveryInfoId: dialog.delivery.deliveryInfoId,
        status: dialog.mode === 'delivered' ? 'delivered' : 'failed',
      }
      if (podNotes !== '') body.podNotes = podNotes
      if (dialog.mode === 'delivered' && cashCollected) body.cashCollected = true
      try {
        const res = await authPostJson('/api/delivery-tracking', body)
        if (res.ok) {
          setDialog(null)
          toast.success(dialog.mode === 'delivered' ? 'Dostava zaključena' : 'Težava prijavljena')
          void refresh()
          return
        }
        const data: unknown = await res.json().catch(() => null)
        if (res.status === 409) {
          setDialog(null)
          toast.info('Stanje je spremenjeno — osveženo')
          void refresh()
          return
        }
        // 400 = neveljaven prehod / validacija — pokaži v dialogu, vnos ostane
        setDialogError(extractErrorMessage(data, `Napaka ${res.status}`))
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          setDialog(null)
          return // hook ob naslednjem pollu preklopi na prijavo
        }
        setDialogError('Povezava ni na voljo')
      } finally {
        setDialogBusy(false)
      }
    },
    [dialog, dialogBusy, refresh],
  )

  // Seja potekla brez standalone login toka (POS modul) — ročen reload
  if (loggedOut && !onLogout) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">Seja je potekla.</p>
        <Button onClick={() => window.location.reload()}>Osveži stran</Button>
      </div>
    )
  }

  return (
    <ErrorBoundary context="Driver" maxRetries={3}>
      <div className="min-h-screen bg-background">
        {/* Header: naslov + povezanost pika + čas zadnjega refresha */}
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-md items-center gap-2 px-4">
            <Bike className="size-5 shrink-0" aria-hidden />
            <h1 className="text-lg font-bold">Dostave</h1>
            <span
              className={`ml-auto inline-block size-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`}
              role="status"
              aria-label={connected ? 'Povezano' : 'Brez povezave'}
            />
            {gps && (
              <span
                className="inline-flex items-center gap-1"
                role="status"
                aria-label={gps.label}
                title={gps.label}
              >
                <MapPin className="size-3.5 text-muted-foreground" aria-hidden />
                <span className={`inline-block size-2 rounded-full ${gps.dot}`} />
                <span className="sr-only">{gps.label}</span>
              </span>
            )}
            <span className="text-xs tabular-nums text-muted-foreground">{timeLabel}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label="Osveži"
              onClick={() => void refresh()}
            >
              <RefreshCw className="size-4" />
            </Button>
            {onLogout && (
              <Button variant="ghost" size="icon" className="size-9" aria-label="Odjava" onClick={onLogout}>
                <LogOut className="size-4" />
              </Button>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-md space-y-6 px-4 pb-10 pt-4">
          {/* Sekcija: Za prevzem (ready[]) */}
          <section aria-label="Za prevzem">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Za prevzem
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold tabular-nums">{ready.length}</span>
            </h2>
            <div className="space-y-3">
              {ready.length === 0 ? (
                <EmptyHint text={isLoading ? 'Nalaganje ...' : 'Ni pripravljenih dostav.'} />
              ) : (
                ready.map((delivery) => (
                  <DeliveryCard
                    key={delivery.id}
                    mode="ready"
                    orderNumber={delivery.order?.orderNumber ?? ''}
                    address={delivery.address}
                    city={delivery.city}
                    postCode={delivery.postCode}
                    recipientName={delivery.recipientName}
                    recipientPhone={delivery.recipientPhone}
                    instructions={delivery.instructions}
                    total={orderTotal(delivery.order)}
                    cash={isCashOnDelivery(delivery.order)}
                    primaryLabel="Prevzem"
                    busy={claimingId === delivery.id}
                    onPrimary={() => void handleClaim(delivery)}
                  />
                ))
              )}
            </div>
          </section>

          {/* Sekcija: Moje dostave (mine[]) */}
          <section aria-label="Moje dostave">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Moje dostave
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold tabular-nums">{mine.length}</span>
            </h2>
            <div className="space-y-3">
              {mine.length === 0 ? (
                <EmptyHint text={isLoading ? 'Nalaganje ...' : 'Ni aktivnih dostav.'} />
              ) : (
                mine.map((delivery) => {
                  const next = delivery.status in NEXT_STATUS ? NEXT_STATUS[delivery.status as ActiveDriverStatus] : undefined
                  return (
                    <DeliveryCard
                      key={delivery.deliveryInfoId}
                      mode="mine"
                      orderNumber={delivery.order?.orderNumber ?? ''}
                      address={delivery.address}
                      city={delivery.city}
                      postCode={delivery.postCode}
                      recipientName={delivery.recipientName}
                      recipientPhone={delivery.recipientPhone}
                      instructions={delivery.instructions}
                      total={orderTotal(delivery.order)}
                      cash={isCashOnDelivery(delivery.order)}
                      status={delivery.status}
                      primaryLabel={next?.label}
                      busy={advancingId === delivery.deliveryInfoId || claimingId === delivery.deliveryInfoId}
                      onPrimary={
                        next
                          ? () => {
                              if (delivery.status === 'arriving') {
                                // 'Dostavljeno' odpre POD dialog (delivered + podNotes/cash)
                                setDialogError('')
                                setDialog({ delivery, mode: 'delivered' })
                                return
                              }
                              void handleAdvance(delivery, next.next)
                            }
                          : undefined
                      }
                      onTrouble={
                        TROUBLE_STATUSES.includes(delivery.status as ActiveDriverStatus)
                          ? () => {
                              setDialogError('')
                              setDialog({ delivery, mode: 'failed' })
                            }
                          : undefined
                      }
                    />
                  )
                })
              )}
            </div>
          </section>
        </main>

        {/* Dialog zaključka (delivered / failed) — pogojni mount z key:
            vsak odprtje = svež vnos (react.dev "reset with key") */}
        {dialog && (
          <DeliverDialog
            key={`${dialog.delivery.deliveryInfoId}:${dialog.mode}`}
            open
            onOpenChange={(open) => {
              if (!open) setDialog(null)
            }}
            mode={dialog.mode}
            orderNumber={dialog.delivery.order?.orderNumber ?? ''}
            cash={isCashOnDelivery(dialog.delivery.order)}
            busy={dialogBusy}
            error={dialogError}
            onSubmit={(result) => void handleDialogSubmit(result)}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}
