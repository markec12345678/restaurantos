// ============================================
// DIGEST URE — "Promet po urah" za dnevni povzetek (R76)
// ============================================
// Čista, strežniško-varna biblioteka (isti vzorec kot digest-trend R71/72
// in pctChange R65): API (fetchDailyDigestData) in UI (digest stran) dela
// z istim virom resnice, testi testirajo čiste funkcije brez db.
//
// Semantika (konsistentna z fetchDailyDigestData):
//   • vhodne vrstice so plačana naročila iz DNEVSKEGA okna (paymentStatus=
//     'paid', server-local bounds) — lib samo razporedi po urah
//   • ura = LOKALNA ura naročila (Date.getHours()) — ista časovna cona kot
//     dayBounds (server-local dan), sicer bi bile mejne ure zamaknjene
//   • 24 vedno polnih vedrov (0–23) — stabilna postavitev, kot 30 stolpcev
//     R72; ure brez prometa ostanejo vidne kot nizki štumpi
//
// Pravila (fail-safe, vzorec toSafeNum):
//   • ne-finitne/negativne vrednosti → 0
//   • neveljaven createdAt (Invalid Date, date-only niz, ne-niz) → vrstica
//     PRESKOČENA (R72 lekcija: sumljiv vnos nikoli ne tiho normalizira —
//     raje manjka kot da pade v napačno vedro)
//   • nizi sprejemi SAMO kot časovni žigi (mora biti 'T' med datumom in
//     uro) — date-only nizi so zavrnjeni že na vhodu
// ============================================

export interface HourlyRowRaw {
  /** Znesek naročila (Prisma Decimal | number | string | null) */
  total: unknown
  /** Čas naročila — Date (Prisma) ali časovni žig niz */
  createdAt: Date | string
}

export interface HourlyPoint {
  /** Ura dneva 0–23 */
  hour: number
  /** Vsota zneskov plačanih naročil v tej uri (€) */
  revenue: number
  /** Število plačanih naročil v tej uri */
  orders: number
  /** Višina stolpca v % (0–100) relativno na vrh urnika */
  heightPct: number
  /** Vrh urnika (najvišji promet; izenačeni → prva ura zasede) */
  isPeak: boolean
  /** Ali ura pokaže tekstovno oznako (vsaka 3. ura + vrh) — oznake ostanejo
   *  v aria-labelih stolpcev za bralnike zaslona */
  showLabel: boolean
}

export interface BusyWindow {
  /** Začetna ura najboljšega zveznega okna (0–21) */
  startHour: number
  /** Končna ura (vključno) = startHour + BUSY_WINDOW_HOURS − 1 */
  endHour: number
  /** Vsota prometa v oknu (€) */
  revenue: number
}

export interface HourlySummary {
  /** Ura vrha ali null (dan brez prometa) */
  peakHour: number | null
  /** Promet vrhunske ure (€) */
  peakRevenue: number
  /** Koliko ur ima sploh promet/naročila (0–24) */
  activeHours: number
  /** Skupni promet po urah (kontrolna vsota = data.revenue) */
  totalRevenue: number
  /** Najboljše zvezno 3-urno okno ali null (dan brez prometa) */
  busyWindow: BusyWindow | null
}

/** Oznake urske osi: vsaka 3. ura (0, 3, 6, … 21) + vrh. */
export const HOURLY_LABEL_STRIDE = 3

/** Širina "najboljšega okna" (zvezne ure z največ prometom). */
export const BUSY_WINDOW_HOURS = 3

function toSafeRevenue(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Lokalna ura vnosa ali null (neuporaben vnos — vrstica se preskoči).
 *  Date → getHours() (lokalno, konsistentno z dayBounds). Niz → SAMO
 *  časovni žig 'YYYY-MM-DDTHH…' (lokalna razčlemitev po specifikaciji);
 *  date-only nizi so zavrnjeni (dvoumna cona + R72 tiha normalizacija). */
function hourOf(createdAt: Date | string): number | null {
  if (createdAt instanceof Date) {
    if (Number.isNaN(createdAt.getTime())) return null
    return createdAt.getHours()
  }
  if (typeof createdAt === 'string') {
    if (!/^(\d{4})-(\d{2})-(\d{2})T/.test(createdAt)) return null
    const d = new Date(createdAt)
    if (Number.isNaN(d.getTime())) return null
    return d.getHours()
  }
  return null
}

/**
 * Iz surovih vrstic plačanih naročil zgradi 24 urnih točk. Čista funkcija —
 * brez db/React odvisnosti; uporablja fetchDailyDigestData (API) in testi.
 */
export function computeHourlyDistribution(rows: HourlyRowRaw[]): HourlyPoint[] {
  const buckets = Array.from({ length: 24 }, () => ({ revenue: 0, orders: 0 }))
  if (Array.isArray(rows)) {
    for (const r of rows) {
      if (!r) continue
      const h = hourOf(r.createdAt)
      if (h == null || h < 0 || h > 23) continue
      buckets[h].revenue += toSafeRevenue(r.total)
      buckets[h].orders += 1
    }
  }

  const max = Math.max(...buckets.map(b => b.revenue))

  // Vrh: najvišji promet; izenačeni → prva (zgodnja) ura zasede.
  // Dan brez prometa → peakHour ostane null (vrh brez podlage bi goljufal).
  let peakHour: number | null = null
  let peakRevenue = 0
  for (let h = 0; h < 24; h++) {
    if (buckets[h].revenue > peakRevenue) {
      peakRevenue = buckets[h].revenue
      peakHour = h
    }
  }

  return buckets.map((b, h) => ({
    hour: h,
    revenue: b.revenue,
    orders: b.orders,
    // 0 promet → višina 0 (UI nariše 2px štump prek minHeight); min 2 % da so
    // majhni stolpci očesno vidni (isti vzorec kot digest-trend R72)
    heightPct: b.revenue > 0 && max > 0 ? Math.max((b.revenue / max) * 100, 2) : 0,
    isPeak: peakHour === h,
    showLabel: h % HOURLY_LABEL_STRIDE === 0 || peakHour === h,
  }))
}

/**
 * Povzetek urnika za čipe sekcije: vrh, zasedenost, najboljše okno.
 * Pričakuje izhod computeHourlyDistribution (že fail-safe); null ko
 * točk ni (stari API odgovori brez `hourly` polja — sekcija se skrije).
 */
export function summarizeHourly(points: HourlyPoint[]): HourlySummary | null {
  if (!Array.isArray(points) || points.length === 0) return null

  let totalRevenue = 0
  let activeHours = 0
  let peakHour: number | null = null
  let peakRevenue = 0
  for (const p of points) {
    const rev = Number.isFinite(p?.revenue) && p.revenue > 0 ? p.revenue : 0
    const ord = Number.isFinite(p?.orders) && p.orders > 0 ? p.orders : 0
    totalRevenue += rev
    if (rev > 0 || ord > 0) activeHours += 1
    if (rev > peakRevenue) {
      peakRevenue = rev
      peakHour = p.hour
    }
  }

  // Najboljše zvezno okno (linearno po dnevu — 23→0 prelom ni relevanten za
  // restavracijo; izenačena okna → najzgodnejše zasede).
  let busyWindow: BusyWindow | null = null
  let bestSum = 0
  for (let s = 0; s + BUSY_WINDOW_HOURS <= 24; s++) {
    let sum = 0
    for (let k = 0; k < BUSY_WINDOW_HOURS; k++) {
      const v = points[s + k]?.revenue
      sum += Number.isFinite(v) && v > 0 ? v : 0
    }
    if (sum > bestSum) {
      bestSum = sum
      busyWindow = { startHour: s, endHour: s + BUSY_WINDOW_HOURS - 1, revenue: sum }
    }
  }

  return { peakHour, peakRevenue, activeHours, totalRevenue, busyWindow }
}
