// ============================================
// R125 / ISSUE #36 FAZA 2 — /api/shifts na StaffShift (Shift model ukinjen)
// ============================================
// Pokritje (kanon R125-a):
//  • GET /api/shifts: bere izključno StaffShift — where (scope/employeeId/
//    status/shiftDate) + include employee/job zajeta; odgovor ohrani legacy
//    kontrakt (`date` alias poleg shiftDate)
//  • from/to parametra (razpored UI) sta podprta kot aliasa dateFrom/dateTo
//  • POST: kreacija v StaffShift (date→shiftDate, jobId, Zod defaulta
//    shiftType 'custom'/role 'server') + shift.started webhook ob in_progress
//  • POST action copy_week: kopira 7-dnevno okno (+7 dni), status resetiran
//    na 'scheduled', actualStart/End + confirmedAt pobrisani, scope uveljavljen,
//    cancelled izključeni; Zod create shema akcije NE zavre
//  • PUT: date→shiftDate preslikava (+ date alias v odgovoru)
//  • DELETE: soft-cancel (status 'cancelled', vrstica ostane)
//  • syncActualTimesFromTimeEntry: izbere in_progress izmeno istega dne,
//    actualStart samo če je null, actualEnd vedno, statusa ne spreminja,
//    tolerantna pri brez kandidatov in pri DB napaki
//  • GDPR anonymize: števec aktivnih izmen bere staffShift (in_progress)
//  • tip-pool POST: staffShift.findMany s status filtrom + scope
//
// Trap DB (hišni stil R124/R119–R123): vi.mock('@/lib/db') getter + vi.hoisted;
// klicane so PRODUKCIJSKE route funkcije direktno; mockana MEJA je samo
// requireAuth + emitEvent (resolveTenantLocationIdOrThrow ostane REALNA).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const LOC_1 = 'loc0001'
const EMP_1 = 'emp-1'
const EMP_2 = 'emp-2'
const JOB_1 = 'job-1'

// ---------- Vrstice ----------
interface StaffShiftRow {
  id: string
  employeeId: string
  jobId: string | null
  shiftDate: Date
  shiftType: string
  startTime: string
  endTime: string
  locationId: string | null
  role: string
  notes: string
  status: string
  confirmedAt: Date | null
  actualStart: Date | null
  actualEnd: Date | null
  breakMinutes: number
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
  employee?: { id: string; name: string; role: string } | null
  job?: { id: string; name: string; basePayRate: number } | null
}
interface EmployeeRow { id: string; name: string; role: string; status: string; locationId: string | null }

type Where = {
  id?: string
  employeeId?: string
  locationId?: string
  status?: string | { in?: string[]; not?: string }
  shiftDate?: { gte?: Date; lte?: Date; lt?: Date }
}

function matchesWhere(row: StaffShiftRow, where?: Where): boolean {
  if (!where) return true
  if (where.id !== undefined && row.id !== where.id) return false
  if (where.employeeId !== undefined && row.employeeId !== where.employeeId) return false
  if (where.locationId !== undefined && row.locationId !== where.locationId) return false
  if (where.status !== undefined) {
    if (typeof where.status === 'string') {
      if (row.status !== where.status) return false
    } else {
      if (where.status.in && !where.status.in.includes(row.status)) return false
      if (where.status.not !== undefined && row.status === where.status.not) return false
    }
  }
  if (where.shiftDate) {
    if (where.shiftDate.gte && row.shiftDate < where.shiftDate.gte) return false
    if (where.shiftDate.lte && row.shiftDate > where.shiftDate.lte) return false
    if (where.shiftDate.lt && row.shiftDate >= where.shiftDate.lt) return false
  }
  return true
}

// ---------- Trap DB ----------
function createDb() {
  const idCounter = { n: 0 }
  const id = (p: string) => `${p}-${++idCounter.n}`

  const staffShifts: StaffShiftRow[] = []
  const employees: EmployeeRow[] = []
  const jobs: { id: string; name: string; basePayRate: number }[] = []
  const captured = {
    findMany: [] as Array<Record<string, unknown>>,
    count: [] as Array<Record<string, unknown>>,
    findFirst: [] as Array<Record<string, unknown>>,
    create: [] as Array<Record<string, unknown>>,
    createMany: [] as Array<Record<string, unknown>>,
    update: [] as Array<Record<string, unknown>>,
  }

  function hydrate(row: StaffShiftRow): StaffShiftRow {
    const emp = employees.find(e => e.id === row.employeeId)
    const job = jobs.find(j => j.id === row.jobId)
    return {
      ...row,
      employee: emp ? { id: emp.id, name: emp.name, role: emp.role } : null,
      job: job ? { ...job } : null,
    }
  }

  const clients = {
    staffShift: {
      findMany: async (args: { where?: Where }) => {
        captured.findMany.push(args as Record<string, unknown>)
        return staffShifts
          .filter(r => matchesWhere(r, args.where))
          .sort((a, b) => a.shiftDate.getTime() - b.shiftDate.getTime())
          .map(r => hydrate(r))
      },
      count: async (args: { where?: Where }) => {
        captured.count.push(args as Record<string, unknown>)
        return staffShifts.filter(r => matchesWhere(r, args.where)).length
      },
      findFirst: async (args: { where?: Where }) => {
        captured.findFirst.push(args as Record<string, unknown>)
        const row = staffShifts.find(r => matchesWhere(r, args.where))
        return row ? hydrate(row) : null
      },
      create: async (args: {
        data: Partial<StaffShiftRow>
        include?: Record<string, unknown>
      }) => {
        captured.create.push(args as Record<string, unknown>)
        const d = args.data
        const row: StaffShiftRow = {
          id: id('ss'),
          employeeId: d.employeeId ?? '',
          jobId: d.jobId ?? null,
          shiftDate: d.shiftDate ?? new Date(),
          shiftType: d.shiftType ?? 'morning',
          startTime: d.startTime ?? '09:00',
          endTime: d.endTime ?? '17:00',
          locationId: d.locationId ?? null,
          role: d.role ?? 'server',
          notes: d.notes ?? '',
          status: d.status ?? 'scheduled',
          confirmedAt: d.confirmedAt ?? null,
          actualStart: d.actualStart ?? null,
          actualEnd: d.actualEnd ?? null,
          breakMinutes: d.breakMinutes ?? 0,
          createdBy: d.createdBy ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        staffShifts.push(row)
        return hydrate(row)
      },
      createMany: async (args: { data: Array<Partial<StaffShiftRow>> }) => {
        captured.createMany.push(args as Record<string, unknown>)
        for (const d of args.data) {
          staffShifts.push({
            id: id('ss'),
            employeeId: d.employeeId ?? '',
            jobId: d.jobId ?? null,
            shiftDate: d.shiftDate ?? new Date(),
            shiftType: d.shiftType ?? 'morning',
            startTime: d.startTime ?? '09:00',
            endTime: d.endTime ?? '17:00',
            locationId: d.locationId ?? null,
            role: d.role ?? 'server',
            notes: d.notes ?? '',
            status: d.status ?? 'scheduled',
            confirmedAt: d.confirmedAt ?? null,
            actualStart: d.actualStart ?? null,
            actualEnd: d.actualEnd ?? null,
            breakMinutes: d.breakMinutes ?? 0,
            createdBy: d.createdBy ?? null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        }
        return { count: args.data.length }
      },
      update: async (args: { where: { id: string }; data: Partial<StaffShiftRow> }) => {
        captured.update.push(args as Record<string, unknown>)
        const row = staffShifts.find(r => r.id === args.where.id)
        if (!row) {
          throw Object.assign(new Error('Record not found'), { code: 'P2025' })
        }
        Object.assign(row, args.data, { updatedAt: new Date() })
        return hydrate(row)
      },
      deleteMany: async (args: { where?: Where }) => {
        let count = 0
        for (let i = staffShifts.length - 1; i >= 0; i--) {
          if (matchesWhere(staffShifts[i], args.where)) {
            staffShifts.splice(i, 1)
            count++
          }
        }
        return { count }
      },
    },
    employee: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const e = employees.find(x => x.id === where.id)
        return e ? { ...e } : null
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const e = employees.find(x => x.id === where.id)
        if (!e) throw Object.assign(new Error('not found'), { code: 'P2025' })
        Object.assign(e, data)
        return { ...e }
      },
    },
    session: { count: async () => 0 },
    auditLog: { create: async () => ({}) },
    payment: { findMany: async () => [] },
    tipPool: { findFirst: async () => null },
  }

  return { db: clients, staffShifts, employees, jobs, captured }
}

// ---------- Mocki (vi.hoisted ref + getter, hišni stil) ----------
const ref = vi.hoisted(() => ({ current: null as unknown as ReturnType<typeof createDb> }))
ref.current = createDb()

const m = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  emitEvent: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  get db() {
    return ref.current.db
  },
}))
vi.mock('@/lib/auth-middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-middleware')>()
  return {
    ...actual,
    requireAuth: (...args: unknown[]) => m.requireAuth(...args),
    // resolveTenantLocationIdOrThrow ostane REALNA (pure) — tenant semantika zares
  }
})
vi.mock('@/lib/event-emitter', () => ({
  emitEvent: (...args: unknown[]) => m.emitEvent(...args),
}))

import { GET as shiftsGet, POST as shiftsPost } from '@/app/api/shifts/route'
import { PUT as shiftPut, DELETE as shiftDelete } from '@/app/api/shifts/[id]/route'
import { POST as gdprAnonymizePost } from '@/app/api/gdpr/anonymize/[employeeId]/route'
import { POST as tipPoolPost } from '@/app/api/tip-pool/route'
import { syncActualTimesFromTimeEntry } from '@/lib/scheduling/actual-times-sync'

const state = ref.current

// ---------- Helperji ----------
function seedBase() {
  state.staffShifts.length = 0
  state.employees.length = 0
  state.jobs.length = 0
  // captured args se čistijo na test (pariteta z vi.clearAllMocks)
  for (const key of Object.keys(state.captured) as Array<keyof typeof state.captured>) {
    state.captured[key].length = 0
  }
  state.employees.push(
    { id: EMP_1, name: 'Ana Novak', role: 'staff', status: 'active', locationId: LOC_1 },
    { id: EMP_2, name: 'Luka Zupan', role: 'chef', status: 'active', locationId: LOC_1 },
  )
  state.jobs.push({ id: JOB_1, name: 'Natakar', basePayRate: 10 })
}

function seedShift(over: Partial<StaffShiftRow> & { id: string; shiftDate: Date }): StaffShiftRow {
  const row: StaffShiftRow = {
    employeeId: EMP_1,
    jobId: null,
    shiftType: 'custom',
    startTime: '09:00',
    endTime: '17:00',
    locationId: LOC_1,
    role: 'server',
    notes: '',
    status: 'scheduled',
    confirmedAt: null,
    actualStart: null,
    actualEnd: null,
    breakMinutes: 30,
    createdBy: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    ...over,
  }
  state.staffShifts.push(row)
  return row
}

function jsonReq(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function authSession(role = 'manager') {
  return {
    session: { employeeId: 'emp-admin', locationId: LOC_1, role },
    error: null,
  }
}

function resetMocks() {
  m.requireAuth.mockResolvedValue(authSession())
  m.emitEvent.mockResolvedValue(undefined)
}

beforeEach(() => {
  vi.clearAllMocks()
  seedBase()
  resetMocks()
})

// ============================================
// GET /api/shifts — StaffShift + legacy `date` alias
// ============================================
describe('GET /api/shifts — StaffShift vir + back-compat odgovor', () => {
  it('vrne StaffShift vrstice z date aliasom + employee/job hydration + scope filter', async () => {
    seedShift({ id: 'ss-a', shiftDate: new Date('2026-08-05T00:00:00Z'), employeeId: EMP_1, jobId: JOB_1, status: 'scheduled' })
    seedShift({ id: 'ss-b', shiftDate: new Date('2026-08-06T00:00:00Z'), employeeId: EMP_2, status: 'scheduled' })
    seedShift({ id: 'ss-out', shiftDate: new Date('2026-08-07T00:00:00Z'), locationId: 'loc-OTHER', status: 'scheduled' })

    const res = await shiftsGet(new Request('http://localhost:3000/api/shifts?employeeId=emp-1&status=scheduled&dateFrom=2026-08-01&dateTo=2026-08-31'))

    expect(res.status).toBe(200)
    const data = await res.json()
    // scope (loc-1) + filtri izključijo tujo lokacijo in emp-2 izmeno
    expect(data.shifts).toHaveLength(1)
    const row = data.shifts[0]
    expect(row.id).toBe('ss-a')
    // legacy kontrakt: date alias + shiftDate oba prisotna, enakovredna
    expect(row.date).toBe(row.shiftDate)
    expect(row.employee).toEqual({ id: EMP_1, name: 'Ana Novak', role: 'staff' })
    expect(row.job).toEqual({ id: JOB_1, name: 'Natakar', basePayRate: 10 })
    expect(data.total).toBe(1)
    expect(data.limit).toBeDefined()
    expect(data.offset).toBeDefined()

    // zajeta poizvedba: scope + filtri + include + orderBy shiftDate
    const args = state.captured.findMany[0] as { where: Where; include: Record<string, unknown>; orderBy: Record<string, string> }
    expect(args.where.locationId).toBe(LOC_1)
    expect(args.where.employeeId).toBe('emp-1')
    expect(args.where.status).toBe('scheduled')
    expect(args.where.shiftDate?.gte).toEqual(new Date('2026-08-01'))
    // FIX r35: konec dneva (23:59:59.999), ne polnoč
    expect(args.where.shiftDate?.lte).toEqual(new Date('2026-08-31T23:59:59.999Z'))
    expect(args.include).toHaveProperty('employee')
    expect(args.include).toHaveProperty('job')
    expect(args.orderBy).toEqual({ shiftDate: 'asc' })
    // count nosi ISTI where (scope dedup)
    expect((state.captured.count[0] as { where: Where }).where).toEqual(args.where)
  })

  it('from/to parametra (razpored UI) delujeta kot aliasa dateFrom/dateTo', async () => {
    const res = await shiftsGet(new Request('http://localhost:3000/api/shifts?from=2026-08-03&to=2026-08-09'))

    expect(res.status).toBe(200)
    const args = state.captured.findMany[0] as { where: Where }
    expect(args.where.shiftDate?.gte).toEqual(new Date('2026-08-03'))
    expect(args.where.shiftDate?.lte).toEqual(new Date('2026-08-09T23:59:59.999Z'))
  })
})

// ============================================
// POST /api/shifts — kreacija StaffShift + webhook
// ============================================
describe('POST /api/shifts — kreacija v StaffShift', () => {
  it('ustvari StaffShift (date→shiftDate, jobId, defaulta shiftType/role) + date alias v odgovoru', async () => {
    const res = await shiftsPost(jsonReq('http://localhost:3000/api/shifts', 'POST', {
      employeeId: EMP_1,
      jobId: JOB_1,
      date: '2026-08-05',
      startTime: '09:00',
      endTime: '17:00',
      status: 'scheduled',
      breakMinutes: 30,
      notes: 'dopoldan',
    }))

    expect(res.status).toBe(201)
    const created = await res.json()
    expect(created.shiftDate).toBe('2026-08-05T00:00:00.000Z')
    expect(created.date).toBe('2026-08-05T00:00:00.000Z') // legacy alias
    expect(created.jobId).toBe(JOB_1)
    expect(created.locationId).toBe(LOC_1)

    // Zod defaulta (superset parity polji, legacy UI ju ne pošilja)
    const args = state.captured.create[0] as { data: Record<string, unknown> }
    expect(args.data.shiftType).toBe('custom')
    expect(args.data.role).toBe('server')
    expect(args.data.shiftDate).toEqual(new Date('2026-08-05'))
    expect(args.data.employeeId).toBe(EMP_1)
    // NI več zapisa v legacy model — samo staffShift.create
    expect(state.staffShifts).toHaveLength(1)
    expect(state.staffShifts[0].status).toBe('scheduled')
  })

  it('status in_progress → sproži shift.started webhook (employeeName/jobName/role)', async () => {
    const res = await shiftsPost(jsonReq('http://localhost:3000/api/shifts', 'POST', {
      employeeId: EMP_1,
      jobId: JOB_1,
      date: '2026-08-05',
      startTime: '09:00',
      endTime: '17:00',
      status: 'in_progress',
    }))

    expect(res.status).toBe(201)
    expect(m.emitEvent).toHaveBeenCalledTimes(1)
    const [event, payload, locationId] = m.emitEvent.mock.calls[0]
    expect(event).toBe('shift.started')
    expect(payload).toMatchObject({
      employeeName: 'Ana Novak',
      jobName: 'Natakar',
      role: 'server',
    })
    expect(typeof payload.shiftId).toBe('string')
    expect(locationId).toBe(LOC_1)
  })

  it('status scheduled → BREZ shift.started webhooka', async () => {
    await shiftsPost(jsonReq('http://localhost:3000/api/shifts', 'POST', {
      employeeId: EMP_1,
      date: '2026-08-05',
      status: 'scheduled',
    }))
    expect(m.emitEvent).not.toHaveBeenCalled()
  })
})

// ============================================
// POST /api/shifts — action copy_week
// ============================================
describe('POST /api/shifts action copy_week — kopiranje tedna', () => {
  it('kopira 3 ne-preklicane izmene z +7d shiftDate, resetiranim statusom in pobrisanimi žigi', async () => {
    // izvorni teden: pon 2026-08-03 … pet 2026-08-07 (R125: 3 aktivne + 1 cancelled)
    seedShift({ id: 'ss-1', shiftDate: new Date('2026-08-03T00:00:00Z'), employeeId: EMP_1, jobId: JOB_1, status: 'completed', confirmedAt: new Date('2026-08-02T10:00:00Z'), actualStart: new Date('2026-08-03T08:55:00Z'), actualEnd: new Date('2026-08-03T17:05:00Z') })
    seedShift({ id: 'ss-2', shiftDate: new Date('2026-08-04T00:00:00Z'), employeeId: EMP_2, status: 'confirmed', shiftType: 'evening', role: 'chef', startTime: '15:00', endTime: '23:00', notes: 'večerna' })
    seedShift({ id: 'ss-3', shiftDate: new Date('2026-08-05T00:00:00Z'), employeeId: EMP_1, status: 'in_progress', actualStart: new Date('2026-08-05T09:00:00Z') })
    seedShift({ id: 'ss-x', shiftDate: new Date('2026-08-06T00:00:00Z'), employeeId: EMP_1, status: 'cancelled' })

    const res = await shiftsPost(jsonReq('http://localhost:3000/api/shifts', 'POST', {
      action: 'copy_week',
      sourceDate: '2026-08-03',
      targetWeekStart: '2026-08-10',
    }))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({ success: true, created: 3 })

    // 3 NOVE izmene (cancelled NI kopiran), izvorne ostanejo
    expect(state.staffShifts).toHaveLength(7)
    const copies = state.staffShifts.filter(r => !['ss-1', 'ss-2', 'ss-3', 'ss-x'].includes(r.id))
    expect(copies).toHaveLength(3)

    const c1 = copies.find(r => r.employeeId === EMP_1 && r.startTime === '09:00' && r.endTime === '17:00' && r.shiftDate.getTime() === Date.parse('2026-08-10T00:00:00Z'))
    expect(c1).toBeDefined()
    const c2 = copies.find(r => r.employeeId === EMP_2)
    expect(c2).toBeDefined()
    const c3 = copies.find(r => r.shiftDate.getTime() === Date.parse('2026-08-12T00:00:00Z'))
    expect(c3).toBeDefined()

    // +7 dni shiftDate, resetirano stanje, ohranjene vsebine
    expect(copies.every(r => r.shiftDate.getTime() >= Date.parse('2026-08-10T00:00:00Z'))).toBe(true)
    expect(copies.every(r => r.status === 'scheduled')).toBe(true)
    expect(copies.every(r => r.confirmedAt === null && r.actualStart === null && r.actualEnd === null)).toBe(true)
    expect(c2?.shiftType).toBe('evening')
    expect(c2?.role).toBe('chef')
    expect(c2?.notes).toBe('večerna')
    expect(copies.every(r => r.locationId === LOC_1)).toBe(true)

    // scope uveljavljen v izvorni poizvedbi + cancelled izključen
    const args = state.captured.findMany[0] as { where: Where }
    expect(args.where.locationId).toBe(LOC_1)
    expect(args.where.status).toEqual({ not: 'cancelled' })
    expect(args.where.shiftDate?.gte).toBeDefined()
    expect(args.where.shiftDate?.lt).toBeDefined()

    // akcija NI šla skozi createShiftSchema Zod — create NI bil klican (samo createMany)
    expect(state.captured.create).toHaveLength(0)
    expect(state.captured.createMany).toHaveLength(1)
  })

  it('prazen izvorni teden → 200 created: 0 (idempotentno)', async () => {
    const res = await shiftsPost(jsonReq('http://localhost:3000/api/shifts', 'POST', {
      action: 'copy_week',
      sourceDate: '2026-08-03',
      targetWeekStart: '2026-08-10',
    }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, created: 0 })
    expect(state.captured.createMany).toHaveLength(0)
  })

  it('neveljaven datum → 400', async () => {
    const res = await shiftsPost(jsonReq('http://localhost:3000/api/shifts', 'POST', {
      action: 'copy_week',
      sourceDate: 'not-a-date',
      targetWeekStart: '2026-08-10',
    }))
    expect(res.status).toBe(400)
  })

  it('isti izvorni in ciljni teden → 400 (zaščita pred podvajanjem)', async () => {
    const res = await shiftsPost(jsonReq('http://localhost:3000/api/shifts', 'POST', {
      action: 'copy_week',
      sourceDate: '2026-08-03',
      targetWeekStart: '2026-08-03',
    }))
    expect(res.status).toBe(400)
    expect(state.staffShifts).toHaveLength(0)
  })
})

// ============================================
// PUT / DELETE /api/shifts/[id]
// ============================================
describe('PUT /api/shifts/[id] — preslikava date→shiftDate', () => {
  it('posodobi shiftDate iz legacy `date` polja in vrne date alias', async () => {
    seedShift({ id: 'ss-a', shiftDate: new Date('2026-08-05T00:00:00Z'), employeeId: EMP_1, jobId: JOB_1 })

    const res = await shiftPut(jsonReq('http://localhost:3000/api/shifts/ss-a', 'PUT', {
      date: '2026-08-20',
      status: 'completed',
      breakMinutes: 45,
    }), { params: Promise.resolve({ id: 'ss-a' }) })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.shiftDate).toBe('2026-08-20T00:00:00.000Z')
    expect(data.date).toBe('2026-08-20T00:00:00.000Z')

    const row = state.staffShifts.find(r => r.id === 'ss-a')
    expect(row?.shiftDate).toEqual(new Date('2026-08-20T00:00:00.000Z'))
    expect(row?.status).toBe('completed')
    expect(row?.breakMinutes).toBe(45)

    const args = state.captured.update[0] as { data: Record<string, unknown> }
    // preslikava: shiftDate, NE date
    expect(args.data.shiftDate).toEqual(new Date('2026-08-20T00:00:00.000Z'))
    expect(args.data.date).toBeUndefined()
  })

  it('izmena tuje lokacije → 404 (scope zaščita)', async () => {
    seedShift({ id: 'ss-b', shiftDate: new Date('2026-08-05T00:00:00Z'), locationId: 'loc-OTHER' })

    const res = await shiftPut(jsonReq('http://localhost:3000/api/shifts/ss-b', 'PUT', { date: '2026-08-20' }), { params: Promise.resolve({ id: 'ss-b' }) })
    expect(res.status).toBe(404)
    expect(state.captured.update).toHaveLength(0)
  })
})

describe('DELETE /api/shifts/[id] — soft-cancel', () => {
  it('nastavi status cancelled (vrstica ostane), ne briše', async () => {
    seedShift({ id: 'ss-a', shiftDate: new Date('2026-08-05T00:00:00Z'), status: 'scheduled' })

    const res = await shiftDelete(new Request('http://localhost:3000/api/shifts/ss-a', { method: 'DELETE' }), { params: Promise.resolve({ id: 'ss-a' }) })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.message).toBe('Izmena preklicana')

    // soft: vrstica še vedno obstaja, samo status
    expect(state.staffShifts).toHaveLength(1)
    expect(state.staffShifts[0].status).toBe('cancelled')
    const args = state.captured.update[0] as { where: { id: string }; data: Record<string, unknown> }
    expect(args.where.id).toBe('ss-a')
    expect(args.data).toEqual({ status: 'cancelled' })
  })
})

// ============================================
// syncActualTimesFromTimeEntry — TimeEntry → StaffShift.actualStart/End
// ============================================
describe('syncActualTimesFromTimeEntry — sinkronizacija dejanskih časov', () => {
  const clockIn = new Date(2026, 7, 5, 8, 55) // 2026-08-05 08:55 lokalno
  const clockOut = new Date(2026, 7, 5, 17, 5) // 2026-08-05 17:05 lokalno

  it('izbere in_progress izmeno istega dne, actualStart pusti (že znan), actualEnd nastavi, status ohrani', async () => {
    const scheduled = seedShift({ id: 'ss-early', shiftDate: new Date(2026, 7, 5, 12, 0), employeeId: EMP_1, status: 'scheduled', startTime: '06:00' })
    const inProgress = seedShift({ id: 'ss-live', shiftDate: new Date(2026, 7, 5, 12, 0), employeeId: EMP_1, status: 'in_progress', startTime: '10:00', actualStart: new Date(2026, 7, 5, 9, 58) })

    await syncActualTimesFromTimeEntry({ employeeId: EMP_1, clockIn, clockOut, locationId: LOC_1 })

    expect(inProgress.actualStart).toEqual(new Date(2026, 7, 5, 9, 58)) // obstoječi NI prepisan
    expect(inProgress.actualEnd).toEqual(clockOut)
    expect(inProgress.status).toBe('in_progress') // statusa NE spreminja
    expect(scheduled.actualEnd).toBeNull() // druga izmena nedotaknjena
    expect(state.captured.update).toHaveLength(1)
    const args = state.captured.update[0] as { where: { id: string }; data: Record<string, unknown> }
    expect(args.where.id).toBe('ss-live')
    expect(args.data).toEqual({ actualStart: new Date(2026, 7, 5, 9, 58), actualEnd: clockOut })
  })

  it('actualStart je null → nastavi se iz clockIn', async () => {
    const live = seedShift({ id: 'ss-live2', shiftDate: new Date(2026, 7, 5, 12, 0), employeeId: EMP_1, status: 'in_progress', startTime: '10:00', actualStart: null })

    await syncActualTimesFromTimeEntry({ employeeId: EMP_1, clockIn, clockOut, locationId: LOC_1 })

    expect(live.actualStart).toEqual(clockIn)
    expect(live.actualEnd).toEqual(clockOut)
  })

  it('brez in_progress → najpoznejši scheduled kandidat istega dne', async () => {
    const early = seedShift({ id: 'ss-e', shiftDate: new Date(2026, 7, 5, 12, 0), employeeId: EMP_1, status: 'scheduled', startTime: '06:00' })
    const late = seedShift({ id: 'ss-l', shiftDate: new Date(2026, 7, 5, 12, 0), employeeId: EMP_1, status: 'confirmed', startTime: '14:00' })

    await syncActualTimesFromTimeEntry({ employeeId: EMP_1, clockIn, clockOut, locationId: LOC_1 })

    expect(late.actualEnd).toEqual(clockOut)
    expect(early.actualEnd).toBeNull()
  })

  it('brez kandidatov (drugačen dan) → no-op brez napake', async () => {
    seedShift({ id: 'ss-other', shiftDate: new Date(2026, 7, 6, 12, 0), employeeId: EMP_1, status: 'in_progress' })

    await expect(syncActualTimesFromTimeEntry({ employeeId: EMP_1, clockIn, clockOut, locationId: LOC_1 })).resolves.toBeUndefined()
    expect(state.captured.update).toHaveLength(0)
  })

  it('DB napaka → tolerirana (ne vraže, samo zalogira)', async () => {
    const orig = state.db.staffShift.findMany
    state.db.staffShift.findMany = async () => { throw new Error('DB down') }
    await expect(syncActualTimesFromTimeEntry({ employeeId: EMP_1, clockIn, clockOut, locationId: LOC_1 })).resolves.toBeUndefined()
    state.db.staffShift.findMany = orig
  })
})

// ============================================
// GDPR anonymize — staffShift in_progress števec
// ============================================
describe('POST /api/gdpr/anonymize/[employeeId] — aktivne izmene prek staffShift', () => {
  it('terminiran zaposleni brez aktivnih izmen → uspešna anonimizacija (staffShift.count)', async () => {
    state.employees.push({ id: 'emp-gdpr', name: 'Maja Kovač', role: 'staff', status: 'terminated', locationId: LOC_1 })

    const res = await gdprAnonymizePost(
      new Request('http://localhost:3000/api/gdpr/anonymize/emp-gdpr', { method: 'POST' }),
      { params: Promise.resolve({ employeeId: 'emp-gdpr' }) },
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    // kanon R125: števec bere staffShift z in_progress filter
    expect(state.captured.count).toHaveLength(1)
    const args = state.captured.count[0] as { where: Where }
    expect(args.where).toEqual({ employeeId: 'emp-gdpr', status: 'in_progress' })
  })

  it('aktivna StaffShift izmena (in_progress) → 400 blokada', async () => {
    state.employees.push({ id: 'emp-gdpr', name: 'Maja Kovač', role: 'staff', status: 'terminated', locationId: LOC_1 })
    seedShift({ id: 'ss-live', shiftDate: new Date(2026, 7, 5, 12, 0), employeeId: 'emp-gdpr', status: 'in_progress' })

    const res = await gdprAnonymizePost(
      new Request('http://localhost:3000/api/gdpr/anonymize/emp-gdpr', { method: 'POST' }),
      { params: Promise.resolve({ employeeId: 'emp-gdpr' }) },
    )

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('aktivne izmene')
  })
})

// ============================================
// tip-pool POST — staffShift vir + status filter
// ============================================
describe('POST /api/tip-pool — StaffShift vir z status filtrom', () => {
  it('poizvedba po izmenah gre v staffShift z statusom completed/in_progress + scope + dnevnimi mejami', async () => {
    m.requireAuth.mockResolvedValue(authSession())

    const res = await tipPoolPost(jsonReq('http://localhost:3000/api/tip-pool', 'POST', { date: '2026-08-05' }))

    // brez delajočih (staffShift.findMany → []) → 400 z jasnim sporočilom
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Ni zaposlenih')

    // kanon R125: staffShift.findMany (NE legacy shift) s status { in } filtrom
    expect(state.captured.findMany).toHaveLength(1)
    const args = state.captured.findMany[0] as { where: Where }
    expect(args.where.status).toEqual({ in: ['completed', 'in_progress'] })
    expect(args.where.locationId).toBe(LOC_1)
    expect(args.where.shiftDate?.gte).toBeDefined()
    expect(args.where.shiftDate?.lt).toBeDefined()
  })
})
