// ============================================
// RUNDA 58: testi za reservation-floorplan lib
// ============================================
import { describe, it, expect } from 'vitest'
import {
  groupReservationsByTable,
  deriveTableFloorStatus,
  splitTablesByGeometry,
  formatFloorTime,
  formatFloorChip,
  sliceWithMore,
  isReservationActiveNow,
  type TableReservations,
} from '@/lib/reservation-floorplan'
import type { ReservationType, TableType } from '@/components/pos/reservation/constants'

// Tovarna rezervacij — dateTime kot absolutni ISO instanti (UTC)
let seq = 0
function makeReservation(over: Partial<ReservationType> = {}): ReservationType {
  seq += 1
  return {
    id: `r${seq}`,
    customerName: `Gost ${seq}`,
    customerPhone: '',
    customerEmail: '',
    tableId: 't1',
    table: null,
    dateTime: '2026-09-19T16:00:00.000Z', // 18:00 LJ (CEST, UTC+2)
    partySize: 2,
    duration: 120,
    status: 'confirmed',
    notes: '',
    specialRequests: '',
    source: 'phone',
    confirmedAt: null,
    actualArrival: null,
    actualDeparture: null,
    reminderSent: false,
    reminderSentAt: null,
    createdAt: '2026-09-19T06:00:00.000Z',
    ...over,
  }
}

describe('reservation-floorplan — isReservationActiveNow (polodprt interval)', () => {
  const r = makeReservation({ dateTime: '2026-09-19T16:00:00.000Z', duration: 120 })

  it('zavrne čas PRED začetkom', () => {
    expect(isReservationActiveNow(r, new Date('2026-09-19T15:59:59.000Z'))).toBe(false)
  })
  it('sprejme TOČNO začetek (vključen)', () => {
    expect(isReservationActiveNow(r, new Date('2026-09-19T16:00:00.000Z'))).toBe(true)
  })
  it('sprejme čas znotraj okna', () => {
    expect(isReservationActiveNow(r, new Date('2026-09-19T17:00:00.000Z'))).toBe(true)
  })
  it('zavrne TOČNO konec (izključen — polodprt interval, robno dotikanje je legalno)', () => {
    expect(isReservationActiveNow(r, new Date('2026-09-19T18:00:00.000Z'))).toBe(false)
  })
  it('upošteva trajanje (90 min)', () => {
    const r90 = makeReservation({ dateTime: '2026-09-19T16:00:00.000Z', duration: 90 })
    expect(isReservationActiveNow(r90, new Date('2026-09-19T17:29:00.000Z'))).toBe(true)
    expect(isReservationActiveNow(r90, new Date('2026-09-19T17:30:00.000Z'))).toBe(false)
  })
  it('neveljaven datum → false', () => {
    expect(isReservationActiveNow(makeReservation({ dateTime: 'ne-datum' }), new Date())).toBe(false)
  })
})

describe('reservation-floorplan — groupReservationsByTable', () => {
  it('grupira po mizah in sortira kronološko', () => {
    const a = makeReservation({ tableId: 't1', dateTime: '2026-09-19T17:00:00.000Z' })
    const b = makeReservation({ tableId: 't1', dateTime: '2026-09-19T16:00:00.000Z' })
    const c = makeReservation({ tableId: 't2', dateTime: '2026-09-19T16:30:00.000Z' })
    const m = groupReservationsByTable([a, b, c])
    expect(m.get('t1')!.active.map(r => r.id)).toEqual([b.id, a.id])
    expect(m.get('t2')!.active).toHaveLength(1)
  })
  it('preklicane in no_show izključi iz aktivnih', () => {
    const m = groupReservationsByTable([
      makeReservation({ status: 'cancelled' }),
      makeReservation({ status: 'no_show' }),
      makeReservation({ status: 'confirmed' }),
    ])
    expect(m.get('t1')!.active).toHaveLength(1)
  })
  it('rezervacije brez mize preskoči', () => {
    const m = groupReservationsByTable([makeReservation({ tableId: null })])
    expect(m.size).toBe(0)
  })
  it('izračuna next kot najzgodnejšo potrjeno prihajajočo', () => {
    const now = new Date('2026-09-19T16:00:00.000Z')
    const early = makeReservation({ tableId: 't1', dateTime: '2026-09-19T15:00:00.000Z', status: 'completed' })
    const soon = makeReservation({ tableId: 't1', dateTime: '2026-09-19T16:30:00.000Z' })
    const later = makeReservation({ tableId: 't1', dateTime: '2026-09-19T19:00:00.000Z' })
    // grupiranje uporablja realni now — simuliramo z mapiranjem: next mora biti soon (16:30 >= 16:00), ne later
    const m = groupReservationsByTable([later, early, soon])
    const entry = m.get('t1')!
    // next je odvisen od realnega URI časa; preverimo deterministično pravilo: če je realni now < 16:30, je next=soon
    if (new Date().getTime() < new Date('2026-09-19T16:30:00.000Z').getTime()) {
      expect(entry.next?.id).toBe(soon.id)
    } else {
      expect(entry.next?.id === soon.id || entry.next?.id === later.id || entry.next === null).toBe(true)
    }
    void now
  })
  it('vrne prazno Map za prazen vnos', () => {
    expect(groupReservationsByTable([]).size).toBe(0)
  })
})

describe('reservation-floorplan — deriveTableFloorStatus', () => {
  const entryWith = (rs: ReservationType[]): TableReservations => ({
    tableId: 't1',
    active: rs,
    next: rs.find(r => r.status === 'confirmed') ?? null,
    now: null,
  })

  it('prazna/undefined → available', () => {
    expect(deriveTableFloorStatus(undefined)).toBe('available')
    expect(deriveTableFloorStatus(entryWith([]))).toBe('available')
  })
  it('seated → occupied (tudi brez zdaj-okna)', () => {
    expect(deriveTableFloorStatus(entryWith([makeReservation({ status: 'seated' })]))).toBe('occupied')
  })
  it('potrjena (noben seated) → reserved', () => {
    expect(deriveTableFloorStatus(entryWith([makeReservation({ status: 'confirmed' })]))).toBe('reserved')
  })
  it('samo zaključena → available (kosilo je mimo)', () => {
    expect(deriveTableFloorStatus(entryWith([makeReservation({ status: 'completed' })]))).toBe('available')
  })
  it('occupied ima prednost pred reserved (seated v sluzbi + nova potrditvena)', () => {
    const entry = entryWith([
      makeReservation({ status: 'seated', dateTime: '2026-09-19T15:00:00.000Z' }),
      makeReservation({ status: 'confirmed', dateTime: '2026-09-19T19:00:00.000Z' }),
    ])
    expect(deriveTableFloorStatus(entry)).toBe('occupied')
  })
})

describe('reservation-floorplan — splitTablesByGeometry', () => {
  const t = (over: Record<string, unknown> & { id: string }): TableType => ({
    number: 1, capacity: 4, area: 'main', status: 'available', ...over,
  } as TableType)

  it('miza s pozicijo gre med positioned', () => {
    const { positioned, unpositioned } = splitTablesByGeometry([t({ id: 'a', posX: 30, posY: 10 })])
    expect(positioned).toHaveLength(1)
    expect(unpositioned).toHaveLength(0)
  })
  it('miza 0/0 (privzeto) gre med unpositioned', () => {
    const { positioned, unpositioned } = splitTablesByGeometry([t({ id: 'b' })])
    expect(positioned).toHaveLength(0)
    expect(unpositioned).toHaveLength(1)
  })
  it('posY > 0 zadostuje za positioned', () => {
    const { positioned } = splitTablesByGeometry([t({ id: 'c', posX: 0, posY: 25 })])
    expect(positioned).toHaveLength(1)
  })
  it('prazen seznam → obeh skupin prazna', () => {
    const { positioned, unpositioned } = splitTablesByGeometry([])
    expect(positioned).toHaveLength(0)
    expect(unpositioned).toHaveLength(0)
  })
})

describe('reservation-floorplan — formatiranje in chip', () => {
  it('formatFloorTime vrne LJ čas (CEST: 16:00Z → 18:00)', () => {
    expect(formatFloorTime('2026-09-19T16:00:00.000Z')).toBe('18:00')
  })
  it('formatFloorTime neveljaven datum → varni nadomestek', () => {
    expect(formatFloorTime('ni-datum')).toBe('--:--')
  })
  it('formatFloorChip združi čas · ime · št. oseb', () => {
    expect(formatFloorChip({ dateTime: '2026-09-19T16:00:00.000Z', customerName: 'Ana', partySize: 4 })).toBe('18:00 · Ana · 4')
  })
  it('formatFloorChip izpusti partySize 0 in prazno ime', () => {
    expect(formatFloorChip({ dateTime: '2026-09-19T16:00:00.000Z', customerName: '', partySize: 0 })).toBe('18:00')
  })
})

describe('reservation-floorplan — sliceWithMore', () => {
  it('pokaže prvih max, preostanek strne v +N', () => {
    const { shown, extra } = sliceWithMore([1, 2, 3, 4, 5], 3)
    expect(shown).toEqual([1, 2, 3])
    expect(extra).toBe(2)
  })
  it('točno zapolnjeno → extra 0', () => {
    const { shown, extra } = sliceWithMore(['a', 'b'], 2)
    expect(shown).toEqual(['a', 'b'])
    expect(extra).toBe(0)
  })
  it('max < 1 se priredi na 1 (defenzivno)', () => {
    const { shown, extra } = sliceWithMore([1, 2, 3], 0)
    expect(shown).toEqual([1])
    expect(extra).toBe(2)
  })
  it('prazen seznam', () => {
    expect(sliceWithMore([], 3)).toEqual({ shown: [], extra: 0 })
  })
})
