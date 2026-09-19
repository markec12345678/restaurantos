'use client'

// ============================================
// RUNDA 58: Tloris pogled rezervacij (read-only kanvas)
// RUNDA 59: OPERATIVNI tloris — hitre akcije statusa v detail panelu
// ============================================
// Vizualni tloris (geometrija miz iz vizualnega urejevalnika, runda 43)
// z današnjimi rezervaciami: naslednja rezervacija kot čip na mizi,
// "zdaj" poudarek (polodprt interval), izpeljan status mize in
// detail panel z vsemi rezervacijami izbrane mize.
// RUNDA 59: detail panel z hitrimi akcijami (Posedljeno / Ni prišel /
// Prekliči / Zaključi) — ista mutacija kot kartice (toast + refetch).
// Miza se ob "Posedljeno" ŽIVO preklopi v Zasedena (API sinhronizira
// status mize) — tloris je zdaj tudi operativna površina, ne samo prikaz.
// RUNDA 59c: varovalka zaskočenega busy — če PUT ne uspe (refetch nikoli
// ne odbije target statusa), je busy po 8 s samodejno sproščen (determinističen
// useEffect timeout; uspešna pot se očisti prek izpeljave prej).
// RUNDA 60: POZICIJSKI UREJEVALNIK — način urejanja omogoči vlečenje miz po
// kanvasu (pointer dogodki = miška + dotik + pisalo) in postavitev
// nepozicioniranih miz na prost slot (findFreeTableSlot). Optimistic overlay
// (lokalni prikaz) + PUT /api/tables/[id] { posX, posY }; napaka → povratek
// + toast. Snap na 2 % mrežo, omejeno na rob tlorisa.

import { memo, useMemo, useState, useCallback, useEffect, useRef, useReducer } from 'react'
import { MapPin, Users, Pencil, Clock, UserCheck, AlertCircle, X, Check, Loader2, Move, MoveHorizontal, RefreshCw } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { ReservationType, TableType } from './constants'
import { statusLabels } from './constants'
import {
  groupReservationsByTable,
  deriveTableFloorStatus,
  splitTablesByGeometry,
  formatFloorTime,
  formatFloorChip,
  findFreeTableSlot,
  snapFloorPos,
  diffFloorStatuses,
  relativeTimeSl,
  type FloorStatus,
  type FloorRect,
  type TableReservations,
} from '@/lib/reservation-floorplan'
import {
  slCount,
  OSEBA_FORMS,
  OSEBA_TOZILNIK_FORMS,
  AKTIVNA_REZERVACIJA_FORMS,
} from '@/lib/sl-plural'

// Barve statusov miz — posojene iz orders tlorisa (enoten vizualni jezik)
// (runda 59c: glej varovalko busy timeout v komponenti)
import { statusColors as floorStatusColors } from '../floorplan/constants'

export interface FloorPlanViewProps {
  reservations: ReservationType[]
  tables: TableType[]
  /** True, ko gledamo današnji dan — samo takrat je "zdaj" logika živa. */
  isToday: boolean
  onEdit: (_r: ReservationType) => void
  /** RUNDA 59: hitre akcije statusa (ista mutacija kot kartice). */
  onStatusChange?: (_id: string, _status: string) => void
  /** RUNDA 61: ŽIVI TLORIS — timestamp zadnjega uspešnega fetcha (ms) za pilulo svežine. */
  dataUpdatedAt?: number
  /** RUNDA 61: trenutno teče osvežitev (vrtinček na gumbu). */
  isRefreshing?: boolean
  /** RUNDA 61: ročna osvežitev (gumb). */
  onManualRefresh?: () => void
}

// RUNDA 59: semantične barve akcij (enoten jezik z ReservationCard) —
// emerald = gost sedel, amber = ni prišel, red = preklic, primary = zaključek.
const actionStyles: Record<string, string> = {
  seated: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20',
  no_show: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20',
  cancelled: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20',
  completed: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400 hover:bg-sky-500/20',
}

const actionIcons: Record<string, React.ReactNode> = {
  seated: <UserCheck className="h-3 w-3" aria-hidden="true" />,
  no_show: <AlertCircle className="h-3 w-3" aria-hidden="true" />,
  cancelled: <X className="h-3 w-3" aria-hidden="true" />,
  completed: <Check className="h-3 w-3" aria-hidden="true" />,
}

// Naslednji dovoljeni prehodi (zrcali API VALID_TRANSITIONS):
const nextActionsByStatus: Record<string, { status: string; label: string }[]> = {
  confirmed: [
    { status: 'seated', label: 'Posedljeno' },
    { status: 'no_show', label: 'Ni prišel' },
    { status: 'cancelled', label: 'Prekliči' },
  ],
  seated: [{ status: 'completed', label: 'Zaključi' }],
}

const shapeClass = (shape: string): string =>
  shape === 'round' ? 'rounded-full' : shape === 'booth' ? 'rounded-2xl' : 'rounded-lg'

const statusText: Record<FloorStatus, string> = {
  available: 'Prosta',
  reserved: 'Rezervirana',
  occupied: 'Zasedena',
}

function floorLabel(status: FloorStatus, count: number): string {
  if (status === 'available') return count === 1 ? 'prosta' : count === 2 ? 'prosti' : 'prostih'
  if (status === 'reserved') return count === 1 ? 'rezervirana' : count === 2 ? 'rezervirani' : 'rezerviranih'
  return count === 1 ? 'zasedena' : count === 2 ? 'zasedeni' : 'zasedenih'
}

// ============================================
// RUNDA 61: FRESHNESS PILL — "zadnja posodobitev pred X" + ročni gumb
// ============================================
// Tikalko vsakih 10 s (relativni čas živi tudi brez novega fetcha); > 90 s
// pomeni zastarelost (npr. zavihek je bil v ozadju) → amber poudarek.
const FRESH_TICK_MS = 10_000
const FRESH_STALE_SEC = 90

const FreshnessPill = memo(function FreshnessPill({
  dataUpdatedAt,
  isRefreshing,
  onManualRefresh,
}: {
  dataUpdatedAt?: number
  isRefreshing?: boolean
  onManualRefresh?: () => void
}) {
  const [, tick] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    const iv = setInterval(tick, FRESH_TICK_MS)
    return () => clearInterval(iv)
  }, [])

  if (dataUpdatedAt === undefined || dataUpdatedAt <= 0) return null
  const seconds = Math.max(0, Math.floor((Date.now() - dataUpdatedAt) / 1000))
  const stale = seconds >= FRESH_STALE_SEC
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 tabular-nums transition-colors duration-300 ${
        stale
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
          : 'border-border/60 bg-background/60 text-muted-foreground'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${stale ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}
      />
      <span aria-live="polite">osveženo {relativeTimeSl(seconds)}</span>
      {onManualRefresh && (
        <button
          type="button"
          onClick={onManualRefresh}
          aria-label="Ročno osveži tloris in rezervacije"
          className="ml-0.5 inline-flex items-center rounded-full p-0.5 transition-all duration-150 hover:scale-110 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>
      )}
    </span>
  )
})

export const FloorPlanView = memo(function FloorPlanView({
  reservations,
  tables,
  isToday,
  onEdit,
  onStatusChange,
  dataUpdatedAt,
  isRefreshing,
  onManualRefresh,
}: FloorPlanViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // RUNDA 59: "zaposlen" marker za pending UX — gumb pokaže vrtinčko, ostali
  // ostanejo onemogočeni, dokler refetch ne potrdi novega statusa (ali vnos
  // izgine). Stanje je IZPELJANO med render (ni setState v efektu, ni refov):
  // ko reservations reflektirajo target status, je busy samodejno "gotov".
  const [clicked, setClicked] = useState<{ id: string; target: string } | null>(null)
  const busy = useMemo(() => {
    if (!clicked) return null
    const r = reservations.find(x => x.id === clicked.id)
    if (!r || r.status === clicked.target) return null
    return clicked
  }, [clicked, reservations])

  // RUNDA 59c: napaka pot — mutacija brez optimistic updatea pomeni, da ob
  // neuspešnem PUT status nikoli ne doseže target, izpeljani busy pa bi
  // ostal zaskočen (vsi gumbi onemogočeni za vedno). Varovalka: 8 s po
  // kliku sprostimo clicked; uspešna pot očisti busy prek izpeljave prej,
  // timeout pa je takrat neškodljiv (setClicked(null) na že mrtvem stanju).
  useEffect(() => {
    if (!clicked) return
    const timer = setTimeout(() => setClicked(null), 8000)
    return () => clearTimeout(timer)
  }, [clicked])

  // ============================================
  // RUNDA 60: POZICIJSKI UREJEVALNIK
  // ============================================
  const queryClient = useQueryClient()
  const [editor, setEditor] = useState(false)
  // Optimistic overlay — prikazana pozicija pred potrditvijo refetcha
  const [overrides, setOverrides] = useState<Record<string, { posX: number; posY: number }>>({})
  // Vlečenje: pointer dogodki (miška + dotik + pisalo, vzorec runda 12/43)
  const [drag, setDrag] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)
  const movedRef = useRef(false) // razloči klik (izbira) od vlečenja
  const containerRef = useRef<HTMLDivElement>(null)

  // Efektivna geometrija mize: override, sicer podatki iz API
  const effRect = useCallback(
    (t: TableType): FloorRect & { rotation: number; shape: string } => {
      const o = overrides[t.id]
      return {
        posX: o?.posX ?? t.posX ?? 0,
        posY: o?.posY ?? t.posY ?? 0,
        width: t.width ?? 8,
        height: t.height ?? 10,
        rotation: t.rotation ?? 0,
        shape: t.shape ?? 'round',
      }
    },
    [overrides],
  )

  // Mutacija pozicije: PUT samo { posX, posY } (Zod schema vse ostalo pusti)
  const positionMutation = useMutation({
    mutationFn: async ({ id, posX, posY }: { id: string; posX: number; posY: number }) => {
      const res = await authFetch(`/api/tables/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ posX, posY }),
      })
      if (!res.ok) throw new Error('PUT /api/tables/[id] neuspešen')
      return res.json()
    },
    onSuccess: (_data, vars) => {
      setOverrides(prev => {
        const next = { ...prev }
        delete next[vars.id]
        return next
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
    },
    onError: (_err, _vars) => {
      // Povratek: brisi override → prikaz skoči nazaj na zadnje znano stanje
      setOverrides(prev => {
        const next = { ...prev }
        delete next[_vars.id]
        return next
      })
      toast.error('Pozicijo mize ni bilo mogoče shraniti — poskusite znova')
    },
  })

  // Vlečenje — premik: snap na 2 % mrežo, omejeno na robove kanvasa
  const applyDrag = useCallback(
    (id: string, deltaXpx: number, deltaYpx: number) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const t = tables.find(x => x.id === id)
      if (!t || !drag) return
      const dX = (deltaXpx / rect.width) * 100
      const dY = (deltaYpx / rect.height) * 100
      const width = t.width ?? 8
      const height = t.height ?? 10
      const maxX = Math.max(0, 100 - width)
      const maxY = Math.max(0, 100 - height)
      const posX = snapFloorPos(drag.origX + dX, 2, 0, maxX)
      const posY = snapFloorPos(drag.origY + dY, 2, 0, maxY)
      movedRef.current = true
      setOverrides(prev => ({ ...prev, [id]: { posX, posY } }))
    },
    [drag, tables],
  )

  // Globalni pointer move/up med vlečenjem (okno = brez trzanja zunaj kanvasa)
  useEffect(() => {
    if (!drag) return
    const onMove = (e: PointerEvent) => applyDrag(drag.id, e.clientX - drag.startX, e.clientY - drag.startY)
    const onUp = () => {
      const t = tables.find(x => x.id === drag.id)
      const o = overrides[drag.id]
      const origX = t?.posX ?? 0
      const origY = t?.posY ?? 0
      if (movedRef.current && o && (o.posX !== origX || o.posY !== origY)) {
        positionMutation.mutate({ id: drag.id, posX: o.posX, posY: o.posY })
      }
      setDrag(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    // overrides namerno zamrznjen ob startu vlečenja (orig pozicija za primerjavo)
  }, [drag, applyDrag, tables, overrides])

  const handleDragStart = useCallback(
    (id: string, e: React.PointerEvent) => {
      if (!editor) return
      if (e.button !== undefined && e.button !== 0) return
      const t = tables.find(x => x.id === id)
      if (!t) return
      const o = overrides[id]
      movedRef.current = false
      setDrag({ id, startX: e.clientX, startY: e.clientY, origX: o?.posX ?? t.posX ?? 0, origY: o?.posY ?? t.posY ?? 0 })
    },
    [editor, tables, overrides],
  )

  // RUNDA 60: postavitev nepozicionirane mize na prvi prost slot
  const placeTable = useCallback(
    (t: TableType) => {
      const width = t.width ?? 8
      const height = t.height ?? 10
      const existing: FloorRect[] = tables
        .filter(x => x.id !== t.id)
        .map(x => ({ posX: x.posX ?? 0, posY: x.posY ?? 0, width: x.width ?? 8, height: x.height ?? 10 }))
        .filter(r => r.posX > 0 || r.posY > 0)
      const slot = findFreeTableSlot(existing, width, height)
      setOverrides(prev => ({ ...prev, [t.id]: slot }))
      positionMutation.mutate({ id: t.id, posX: slot.posX, posY: slot.posY })
    },
    [tables, positionMutation],
  )

  const handleAction = useCallback(
    (id: string, status: string) => {
      if (!onStatusChange) return
      setClicked({ id, target: status })
      onStatusChange(id, status)
    },
    [onStatusChange],
  )

  const grouped = useMemo(
    () => (isToday ? groupReservationsByTable(reservations) : new Map<string, TableReservations>()),
    [reservations, isToday],
  )
  const { positioned, unpositioned } = useMemo(() => splitTablesByGeometry(tables), [tables])

  const statusOf = useCallback(
    (tableId: string): FloorStatus => deriveTableFloorStatus(isToday ? grouped.get(tableId) : undefined),
    [grouped, isToday],
  )

  const counts = useMemo(() => {
    const c: Record<FloorStatus, number> = { available: 0, reserved: 0, occupied: 0 }
    for (const t of tables) c[statusOf(t.id)] += 1
    return c
  }, [tables, statusOf])

  // ============================================
  // RUNDA 61: ŽIVI TLORIS — utrip spremembe statusa mize
  // ============================================
  // Med osvežitvami (avtomatske 30/45 s ali refetch po akciji) primerjamo
  // izpeljane statuse; miza s prehodom (npr. Prosta → Zasedena, ker jo je
  // sosed posedel) dobi 2× utrip obroča (~2,1 s). Prva predstavitev (prev
  // prazen) ne utripa. Utrip se samočisti po 3 s.
  const prevStatusesRef = useRef<Map<string, FloorStatus> | null>(null)
  const [flashIds, setFlashIds] = useState<Set<string>>(() => new Set<string>())

  useEffect(() => {
    const current = new Map<string, FloorStatus>()
    for (const t of tables) current.set(t.id, statusOf(t.id))
    const prev = prevStatusesRef.current
    prevStatusesRef.current = current
    if (!prev || prev.size === 0) return
    const changed = diffFloorStatuses(prev, current)
    if (changed.length > 0) setFlashIds(new Set(changed))
  }, [tables, statusOf])

  useEffect(() => {
    if (flashIds.size === 0) return
    const timer = setTimeout(() => setFlashIds(new Set()), 3000)
    return () => clearTimeout(timer)
  }, [flashIds])

  const selected = selectedId ? tables.find(t => t.id === selectedId) ?? null : null
  const selectedEntry = selectedId && isToday ? grouped.get(selectedId) : undefined

  const renderTableBody = useCallback(
    (t: TableType, entry: TableReservations | undefined) => {
      const status = deriveTableFloorStatus(entry)
      const colors = floorStatusColors[status] ?? floorStatusColors.available
      const anchor = entry?.now ?? entry?.next
      const extraCount = entry ? Math.max(0, entry.active.length - (anchor ? 1 : 0)) : 0
      return (
        <>
          {/* Statusna pika (pulzirajoča za žive dogodke) */}
          <span
            aria-hidden="true"
            className={`absolute -top-1 -right-1 h-3 w-3 rounded-full ${colors.dot} ${status !== 'available' ? 'animate-pulse' : ''} z-20`}
          />
          <span className={`text-sm font-bold leading-none ${colors.text}`}>{t.number}</span>
          <span className={`flex items-center gap-0.5 text-[10px] opacity-70 ${colors.text} tabular-nums`}>
            <Users className="h-2.5 w-2.5" aria-hidden="true" />
            {t.capacity}
          </span>
          {/* "ZDAJ" žig — rezervacija v polodprtem oknu [start, end) */}
          {entry?.now && (
            <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary animate-fade-in-up">
              <Clock className="h-2.5 w-2.5" aria-hidden="true" /> zdaj
            </span>
          )}
          {/* Naslednja rezervacija — čip z LJ časom (tabular-nums) */}
          {entry?.next && !entry.now && (
            <span className={`mt-0.5 max-w-full truncate rounded-full bg-background/80 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums ${colors.text}`}>
              {formatFloorChip(entry.next)}
            </span>
          )}
          {extraCount > 0 && (
            <span className={`text-[9px] font-semibold ${colors.text} opacity-80`}>+{extraCount}</span>
          )}
          {entry?.now && entry.next && entry.next.id !== entry.now.id && (
            <span className={`text-[9px] font-semibold ${colors.text} opacity-80`}>
              nato {formatFloorTime(entry.next.dateTime)}
            </span>
          )}
        </>
      )
    },
    [],
  )

  const tableButtonClass = useCallback(
    (tableId: string, shape: string) => {
      const status = statusOf(tableId)
      const colors = floorStatusColors[status] ?? floorStatusColors.available
      const isSelected = selectedId === tableId
      return `group absolute flex flex-col items-center justify-center gap-0.5 text-center transition-all duration-200 ${shapeClass(shape)} ${colors.bg} border-2 ${colors.border} shadow-md hover:shadow-lg hover:scale-[1.03] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'z-10'} animate-fade-in-up`
    },
    [statusOf, selectedId],
  )

  return (
    <div className="space-y-3">
      {/* Legenda + števec (sl-plural: 1 prosta · 2 prosti · 5 prostih) + RUNDA 61: svežina + RUNDA 60: urejevalnik */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground" aria-live="polite">
        {(['available', 'reserved', 'occupied'] as const).map(s => (
          <span key={s} className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2 py-0.5">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${floorStatusColors[s].dot}`} />
            {counts[s]} {floorLabel(s, counts[s])}
          </span>
        ))}
        {!isToday && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">arhivski dan — brez "zdaj" logike</span>
        )}
        {/* RUNDA 61: živost podatkov — zadnja posodobitev + ročni gumb (desna skupina z urejevalnikom) */}
        <span className="ml-auto inline-flex items-center gap-2">
          <FreshnessPill dataUpdatedAt={dataUpdatedAt} isRefreshing={isRefreshing} onManualRefresh={onManualRefresh} />
          <button
            type="button"
            onClick={() => { setEditor(prev => !prev); setSelectedId(null) }}
            aria-pressed={editor}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              editor
                ? 'border-primary/50 bg-primary/10 text-primary shadow-sm'
                : 'border-border/60 bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-primary'
            }`}
          >
            <Move className="h-3 w-3" aria-hidden="true" />
            {editor ? 'Zaključi urejanje' : 'Uredi pozicije'}
          </button>
        </span>
      </div>

      {tables.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 py-12 text-center animate-fade-in-up">
          <MapPin className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
          <p className="text-sm font-medium text-muted-foreground">Ni miz za prikaz tlorisa</p>
          <p className="text-xs text-muted-foreground/70">Mize se ustvarijo v prodajnem tlorisu.</p>
        </div>
      ) : (
        <div
          ref={containerRef}
          // Dot-mreža ozadja — subtilen "risovalni papir" vizualni jezik.
          // RUNDA 60: način urejanja = poudarjen okvir + koordinatni akcent.
          className={`relative w-full overflow-hidden rounded-xl border-2 shadow-inner transition-colors duration-300 ${
            editor
              ? 'border-primary/50 bg-primary/[0.04]'
              : 'border-border/70 bg-muted/20'
          }`}
          style={{
            minHeight: '440px',
            backgroundImage: 'radial-gradient(circle, hsl(var(--border) / 0.55) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
          role="group"
          aria-label={editor ? 'Tloris miz — način urejanja pozicij' : 'Tloris miz z današnjimi rezervacijami'}
        >
          {/* RUNDA 60: urejevalni znak — lebdeča pilula z namigi */}
          {editor && (
            <div className="pointer-events-none absolute left-2 top-2 z-40 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-background/90 px-2.5 py-1 text-[10px] font-bold text-primary shadow-md animate-fade-in-up">
              <MoveHorizontal className="h-3 w-3" aria-hidden="true" />
              UREJANJE — vleci mize po tlorisu
            </div>
          )}
          {positioned.map((t, i) => {
            const entry = isToday ? grouped.get(t.id) : undefined
            const status = deriveTableFloorStatus(entry)
            const rect = effRect(t)
            const isDragging = drag?.id === t.id
            // RUNDA 61: živi tloris — miza s spremembo statusa dobi 2× utrip obroča
            const isFlashing = flashIds.has(t.id)
            return (
              <button
                key={t.id}
                type="button"
                onPointerDown={e => handleDragStart(t.id, e)}
                onClick={() => {
                  if (editor && movedRef.current) return // to je bil drag, ne klik
                  setSelectedId(prev => (prev === t.id ? null : t.id))
                }}
                aria-label={`Miza ${t.number}, ${statusText[status]}${entry?.next ? `, naslednja rezervacija ${formatFloorTime(entry.next.dateTime)}, ${entry.next.customerName}` : ''}${editor ? ' — vleci za premik' : ''}`}
                aria-pressed={selectedId === t.id}
                className={`${tableButtonClass(t.id, rect.shape)} ${editor ? 'cursor-grab touch-none active:cursor-grabbing' : ''} ${
                  isDragging ? 'z-50 scale-[1.06] shadow-xl ring-2 ring-primary/70 transition-none cursor-grabbing' : ''
                } ${isFlashing ? 'animate-live-flash' : ''}`}
                style={{
                  left: `${rect.posX}%`,
                  top: `${rect.posY}%`,
                  width: `${rect.width}%`,
                  height: `${rect.height}%`,
                  transform: `rotate(${rect.rotation}deg)`,
                  minWidth: '64px',
                  minHeight: '56px',
                  // utrip ne sme čakati na vstopni stagger
                  animationDelay: isFlashing ? '0ms' : `${Math.min(i * 45, 360)}ms`,
                }}
              >
                {renderTableBody(t, entry)}
              </button>
            )
          })}
          {positioned.length === 0 && (
            <div className="flex h-full min-h-[440px] items-center justify-center p-6 text-center text-xs text-muted-foreground">
              {editor
                ? 'Kanvas je prazen — postavi mize iz mreže spodaj.'
                : 'Mize še niso pozicionirane na tlorisu — prikazane spodaj v mreži.'}
            </div>
          )}
        </div>
      )}

      {/* Nepozicionirane mize — kompaktna mreža (fallback) + RUNDA 60: postavitev */}
      {unpositioned.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Nepozicionirane mize
            {editor && <span className="ml-2 font-normal normal-case text-primary/80">— postavi jih na tloris</span>}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {unpositioned.map((t, i) => {
              const entry = isToday ? grouped.get(t.id) : undefined
              const status = deriveTableFloorStatus(entry)
              const colors = floorStatusColors[status] ?? floorStatusColors.available
              const isPlacing = positionMutation.isPending && positionMutation.variables?.id === t.id
              // RUNDA 61: živi tloris — tudi fallback mreža utripne ob spremembi
              const isFlashing = flashIds.has(t.id)
              return (
                <div
                  key={t.id}
                  className={`relative flex items-stretch gap-1 rounded-lg border-2 ${colors.border} ${colors.bg} p-1 pr-2 transition-all duration-200 animate-fade-in-up ${editor ? 'border-dashed shadow-sm' : ''} ${isFlashing ? 'animate-live-flash' : ''}`}
                  style={{ animationDelay: isFlashing ? '0ms' : `${Math.min(i * 40, 320)}ms` }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(prev => (prev === t.id ? null : t.id))}
                    aria-pressed={selectedId === t.id}
                    className={`flex flex-1 items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left transition-all duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
                  >
                    <span className="flex flex-col">
                      <span className={`text-xs font-bold ${colors.text}`}>Miza {t.number}</span>
                      <span className="text-[10px] opacity-70 tabular-nums text-muted-foreground">
                        {t.capacity} mest · {statusText[status]}
                      </span>
                    </span>
                    {entry?.next && (
                      <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-muted-foreground">
                        {formatFloorTime(entry.next.dateTime)}
                      </span>
                    )}
                  </button>
                  {/* RUNDA 60: postavi na prvi prost slot na kanvasu */}
                  {editor && (
                    <button
                      type="button"
                      onClick={() => placeTable(t)}
                      disabled={positionMutation.isPending}
                      aria-label={`Postavi mizo ${t.number} na tloris`}
                      className="inline-flex shrink-0 flex-col items-center justify-center gap-0.5 self-stretch rounded-md border border-primary/40 bg-primary/10 px-2 text-[9px] font-bold text-primary transition-all duration-150 hover:scale-[1.04] hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                    >
                      {isPlacing ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Move className="h-3 w-3" aria-hidden="true" />}
                      Postavi
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Detail panel izbrane mize — vse rezervacije (preklicane prečrtane) */}
      {selected && (
        <div className="rounded-xl border border-border/70 bg-background/70 p-3 shadow-sm animate-fade-in-up" aria-live="polite">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">
              Miza {selected.number}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {isToday && selectedEntry ? slCount(selectedEntry.active.length, AKTIVNA_REZERVACIJA_FORMS) : 'arhivski dan'}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Zapri
            </button>
          </div>
          {!selectedEntry || selectedEntry.active.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">
              — brez aktivnih rezervacij za ta dan —
            </p>
          ) : (
            <ul className="space-y-1.5">
              {selectedEntry.active.map((r: ReservationType, i: number) => (
                <li
                  key={r.id}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs animate-fade-in-up ${
                    r.status === 'completed' ? 'opacity-70' : ''
                  }`}
                  style={{ animationDelay: `${Math.min(i * 35, 280)}ms` }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatFloorTime(r.dateTime)}–{formatFloorTime(new Date(new Date(r.dateTime).getTime() + (r.duration || 120) * 60000).toISOString())}
                    </span>
                    <span className={`truncate font-medium ${r.status === 'cancelled' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {r.customerName}
                    </span>
                    {/* RUNDA 59: prava sklanjatev — "2 osebi" (dvojina), ne trdo "oseb" */}
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {slCount(r.partySize, OSEBA_FORMS)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {statusLabels[r.status] ?? r.status}
                    </span>
                    {/* RUNDA 59: hitre akcije statusa — enake prehode kot kartice.
                        Busy: vrtinčka na kliknjenem gumbu, ostali disabled. */}
                    {onStatusChange && nextActionsByStatus[r.status]?.map(action => {
                      const isBusy = busy?.id === r.id && busy.target === action.status
                      const anyBusy = Boolean(busy)
                      return (
                        <button
                          key={action.status}
                          type="button"
                          disabled={anyBusy}
                          onClick={() => handleAction(r.id, action.status)}
                          aria-busy={isBusy}
                          aria-label={`${action.label}: ${r.customerName}, ${slCount(r.partySize, OSEBA_TOZILNIK_FORMS)} — ${formatFloorTime(r.dateTime)}`}
                          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 ${actionStyles[action.status]} ${!anyBusy ? 'hover:scale-[1.05]' : ''} animate-fade-in-up`}
                          style={{ animationDelay: `${Math.min(120 + (r.status === 'confirmed' ? nextActionsByStatus[r.status]?.indexOf(action) ?? 0 : 0) * 40, 240)}ms` }}
                        >
                          {isBusy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : actionIcons[action.status]}
                          {action.label}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => onEdit(r)}
                      disabled={Boolean(busy)}
                      className="inline-flex items-center gap-1 rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                      aria-label={`Uredi rezervacijo za ${r.customerName}`}
                    >
                      <Pencil className="h-2.5 w-2.5" aria-hidden="true" /> Uredi
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
})
