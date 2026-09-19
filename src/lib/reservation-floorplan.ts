// ============================================
// RUNDA 58: Rezervacije ↔ tloris (floor plan) sync
// ============================================
// Čiste pomožne funkcije za novi "Tloris" pogled v Rezervacijah:
// mize s pozicijsko geometrijo (posX/posY iz vizualnega tlorisa,
// runda 43 sinhronizacija) dobijo današnje rezervacije, izpeljan
// status mize (prosta / rezervirana / zasedena) in "zdaj" okna.
//
// Model časa: polodprt interval [start, start + duration) — enako kot
// konfliktna detekcija v /api/reservations (robno dotikanje je legalno).

import type { ReservationType, TableType } from '@/components/pos/reservation/constants'
import { formatLjubljanaTime } from './reservation-timeline'

/** Izpeljan status mize na tlorisu (enake barve kot orders tloris). */
export type FloorStatus = 'available' | 'reserved' | 'occupied'

export interface TableReservations {
  tableId: string
  /** Vse današnje rezervacije mize (razen preklicanih), kronološko. */
  active: ReservationType[]
  /** Naslednja potrjena rezervacija z začetkom >= now (ali null). */
  next: ReservationType | null
  /** Rezervacija, katere okno pokriva now (ali null). */
  now: ReservationType | null
}

/** Ali okno rezervacije [start, start+duration) pokriva `now`? (polodprt interval) */
export function isReservationActiveNow(r: Pick<ReservationType, 'dateTime' | 'duration'>, now: Date = new Date()): boolean {
  const start = new Date(r.dateTime).getTime()
  if (Number.isNaN(start)) return false
  const end = start + Math.max(1, r.duration || 120) * 60_000
  return start <= now.getTime() && now.getTime() < end
}

/**
 * Grupiranje rezervacij po mizah: kronološko, brez preklicanih/no-show.
 * Rezervacije brez mize (tableId null) preskoči — tloris pokaže samo vezave.
 */
export function groupReservationsByTable(reservations: readonly ReservationType[]): Map<string, TableReservations> {
  const map = new Map<string, ReservationType[]>()
  for (const r of reservations) {
    if (!r.tableId) continue
    if (r.status === 'cancelled' || r.status === 'no_show') continue
    const list = map.get(r.tableId)
    if (list) list.push(r)
    else map.set(r.tableId, [r])
  }
  const result = new Map<string, TableReservations>()
  const now = new Date()
  for (const [tableId, list] of map) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime(),
    )
    const nowEntry = sorted.find(r => isReservationActiveNow(r, now)) ?? null
    const nextEntry = sorted.find(r => r.status === 'confirmed' && new Date(r.dateTime).getTime() >= now.getTime()) ?? null
    result.set(tableId, { tableId, active: sorted, next: nextEntry, now: nowEntry })
  }
  return result
}

/**
 * Izpeljan status mize:
 *  • seated (trenutno ali danes) → occupied
 *  • potrjena rezervacija v "zdaj" oknu ali prihajajoča → reserved
 *  • sicer → available
 */
export function deriveTableFloorStatus(entry: TableReservations | undefined): FloorStatus {
  if (!entry || entry.active.length === 0) return 'available'
  if (entry.active.some(r => r.status === 'seated')) return 'occupied'
  if (entry.now && entry.now.status === 'confirmed') return 'reserved'
  if (entry.next) return 'reserved'
  return 'available'
}

/** Razdeli mize na pozicionirane (tloris) in nepozicionirane (fallback mreža). */
export function splitTablesByGeometry(tables: readonly TableType[]): { positioned: TableType[]; unpositioned: TableType[] } {
  const positioned: TableType[] = []
  const unpositioned: TableType[] = []
  for (const t of tables) {
    if ((t.posX ?? 0) > 0 || (t.posY ?? 0) > 0) positioned.push(t)
    else unpositioned.push(t)
  }
  return { positioned, unpositioned }
}

/** "18:00" v LJ času; neveljaven datum → '--:--' (varna oznaka). */
export function formatFloorTime(dateTime: string): string {
  return formatLjubljanaTime(dateTime) ?? '--:--'
}

/** Chip podatek za mizo: "18:00 · Ana · 4" (brez praznih delov). */
export function formatFloorChip(r: Pick<ReservationType, 'dateTime' | 'customerName' | 'partySize'>): string {
  const parts = [formatFloorTime(r.dateTime), r.customerName, r.partySize > 0 ? String(r.partySize) : '']
  return parts.filter(Boolean).join(' · ')
}

/** Pokaže prvih `max` elementov, preostanek strne v "+N". */
export function sliceWithMore<T>(items: readonly T[], max: number): { shown: T[]; extra: number } {
  const safeMax = Math.max(1, max)
  return { shown: items.slice(0, safeMax), extra: Math.max(0, items.length - safeMax) }
}

// ============================================
// RUNDA 60: pozicijski urejevalnik — čista geometrijska logika
// (postavitev nepozicioniranih miz + snap na mrežo)
// ============================================

/** Pravokotnik mize v odstotkih tlorisa. */
export interface FloorRect {
  posX: number
  posY: number
  width: number
  height: number
}

/**
 * Zaokroži pozicijo na mrežo (privzeto 2 %) in jo stisne v [min, max].
 * Negativne/neštevilske vrednosti varno vrne na min.
 */
export function snapFloorPos(value: number, step = 2, min = 0, max = 90): number {
  const safe = Number.isFinite(value) ? value : min
  const snapped = Math.round(safe / step) * step
  return Math.max(min, Math.min(max, snapped))
}

/** Ali se dva pravokotnika prekrivata (z varnostnim odmikom, privzeto 1 %)? */
export function rectsOverlap(a: FloorRect, b: FloorRect, margin = 1): boolean {
  return (
    a.posX < b.posX + b.width + margin &&
    a.posX + a.width + margin > b.posX &&
    a.posY < b.posY + b.height + margin &&
    a.posY + a.height + margin > b.posY
  )
}

/**
 * Najde prvi prost slot na kandidatski mreži (4 stolpci × 6 vrst),
 * kjer se miza (width × height) ne prekriva z obstoječimi pravokotniki.
 * Vsi zasedeni → determinističen kaskadni fallback (vcenter/diagonala).
 * Nikoli ne vrne (0,0) — to je znamenje "nepozicionirana".
 */
export function findFreeTableSlot(
  existing: readonly FloorRect[],
  width: number,
  height: number,
): { posX: number; posY: number } {
  const cols = [2, 26, 50, 74]
  const rows = [4, 18, 32, 46, 60, 74]
  for (const posY of rows) {
    for (const posX of cols) {
      const candidate: FloorRect = { posX, posY, width, height }
      if (!existing.some(other => rectsOverlap(candidate, other))) {
        return { posX, posY }
      }
    }
  }
  // Kaskadni fallback — zagotovo dosegljiv, drag ga refineira
  const n = existing.length
  return { posX: snapFloorPos(46 + (n % 3) * 8), posY: snapFloorPos(38 + (n % 4) * 10) }
}
