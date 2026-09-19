// ─── RUNDA 52: časovna matematika rezervacijskega timeline-a ───
// FIX: TimelineView je doslej grupiral rezervacije po STRING primerjavi
// (localeCompare) — leksikografska razdalja NI časovna razdalja
// (npr. rezervacija ob 15:00 → slot '14:00' namesto '14:30'). Zdaj:
// prava minutna razdalja (_date-lessly, čisto HH:MM aritmetika).
//
// Slots so vedno istega formata 'HH:MM' (constants.ts timeSlots).

/** 'HH:MM' → minute od polnoči. Neveljaven vnos → null. */
export function hmToMinutes(hm: string): number | null {
  if (typeof hm !== 'string' || !/^\d{1,2}:\d{2}$/.test(hm)) return null
  const [h, m] = hm.split(':').map(Number)
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

/**
 * Najbližji slot (po PRAVI minutni razdalji). Neznani 'HH:MM' → null.
 * Izjema: rezervacija pred prvim slotom (npr. 10:30 pri slotih 11:00+)
 * → vrne prvi slot (brez 'prejšnjega' kandidata), kar je isti kontrakt
 * kot prejšnji localeCompare fallback, a zdaj znapred determinističen.
 * Rezervacija za zadnjim slotom → zadnji slot.
 */
export function closestTimeSlot(time: string, slots: readonly string[]): string | null {
  const target = hmToMinutes(time)
  if (target === null || slots.length === 0) return null

  let best: string | null = null
  let bestDist = Number.POSITIVE_INFINITY
  for (const slot of slots) {
    const mins = hmToMinutes(slot)
    if (mins === null) continue
    const dist = Math.abs(mins - target)
    if (dist < bestDist) {
      bestDist = dist
      best = slot
    }
  }
  return best
}

/** Premik 'HH:MM' za ±N minut (wrap okoli polnoči ni podprt — dnevni UI). */
export function shiftHm(hm: string, deltaMinutes: number): string | null {
  const base = hmToMinutes(hm)
  if (base === null || !Number.isFinite(deltaMinutes)) return null
  const shifted = base + Math.trunc(deltaMinutes)
  if (shifted < 0 || shifted > 23 * 60 + 59) return null
  const h = Math.floor(shifted / 60)
  const m = shifted % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ─── RUNDA 55: delta za drag-to-reschedule ───
// Drag na timeline: karta se spusti na slot; delta (v minutah) pove,
// KOLIKO se dateTime premakne — lahko tudi negativno (drag navzgor).
// Rezervacija NI vedno točno na slotu (npr. 19:15), zato delta = cilj −
// trenutno, ne "na najbližji slot od polnoči".

/** Minute med dvema 'HH:MM' vrednostma (to − from). Neveljaven vnos → null. */
export function hmDelta(fromHm: string, toHm: string): number | null {
  const from = hmToMinutes(fromHm)
  const to = hmToMinutes(toHm)
  if (from === null || to === null) return null
  return to - from
}

// ─── RUNDA 54: LJ-časovni žig za API sporočila ───
// BUG (živ na produkciji, ujet v QA R54): 409 konfliktno sporočilo je
// gradilo čas z new Date(...).toLocaleTimeString('sl-SI') NA STREŽNIKU —
// Vercel teče v UTC, zato je gost s komaj zaznavnim odmikom videl
// "Miza je že rezervirana ob 17:00:00", čeprav je njegova rezervacija ob
// 19:00 po ljubljanskem času (+ sekundni prikaz = šum). Zdaj ekspliciten
// timeZone — strežniška časovna cona NE sme uhajati v UI sporočila.

/**
 * 'HH:MM' v ljubljanski časovni coni (zimski/letni prehod iz datuma).
 * Neveljaven datum → null (klicatelj skrije del časa, ne prikaže smeti).
 */
export function formatLjubljanaTime(date: Date | string | number): string | null {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('sl-SI', {
    timeZone: 'Europe/Ljubljana',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

// ─── RUNDA 57: oznaka značke opomnika z časovnim žigom ───
// reminderSent flag (R54) pove SAMO DA je opomnik odšel — gostiteljica ne
// ve KDY. reminderSentAt (schema R57) nosi timestamp; značka tako pokaže
// "Opomnik poslan ob 19:00". Starejše vrstice (flag brez timestampa) in
// pokvarjen datum padejo nazaj na suho "Opomnik poslan".

/**
 * Besedilo značke opomnika: "Opomnik poslan ob HH:MM" (LJ cona), ali
 * "Opomnik poslan", če timestamp manjka/neveljaven. `reminderSent=false`
 * → null (klicatelj značke ne izriše).
 */
export function reminderBadgeLabel(
  reminderSent: boolean,
  reminderSentAt: Date | string | number | null | undefined,
): string | null {
  if (!reminderSent) return null
  const at = reminderSentAt == null ? null : formatLjubljanaTime(reminderSentAt)
  return at ? `Opomnik poslan ob ${at}` : 'Opomnik poslan'
}

// ─── RUNDA 53: pravi interval-overlap za konflikt detekcijo ───
// Prej je PUT /api/reservations/[id] iskal findFirst kandidatko z
// dateTime <= newEnd in preveril SAMO njo — findFirst brez orderBy vrne
// arbitrarno vrstico, lahko torej "poišče" rezervacijo, ki se konča PREJ
// našega začetka (ni konflikt), medtem ko pravi konflikt obstaja drugje
// (lažni negativ) ali pa prijavi neprekrivajočo (lažni pozitiv).
//
// Kanonični pogoj prekrivanja polodprtih intervalov [start, end):
//   startA < endB  &&  endA > startB
// Dotikajoča se robova (konec == začetek) NE štejeta — miza je ob
// polnoči prostih takoj, ko se prejšnja gostija zaključi.

/**
 * Prekrivanje dveh časovnih intervalov (epoch ms). Dotik robov NI
 * prekrivanje. Obrnjeni argumenti se normalizirajo (varnost), ne-finite
 * vrednosti (NaN/Infinity) → false (pokvarjen vnos nikoli ni konflikt).
 * Ničelni interval (start == end) je "trenutek": trenutek ZNOTRAJ
 * zasedenega okna je konflikt, na robu ali zunaj pa ne.
 */
export function intervalsOverlap(
  aStartMs: number,
  aEndMs: number,
  bStartMs: number,
  bEndMs: number,
): boolean {
  if (![aStartMs, aEndMs, bStartMs, bEndMs].every(Number.isFinite)) return false
  const [aS, aE] = aStartMs <= aEndMs ? [aStartMs, aEndMs] : [aEndMs, aStartMs]
  const [bS, bE] = bStartMs <= bEndMs ? [bStartMs, bEndMs] : [bEndMs, bStartMs]
  return aS < bE && aE > bS
}
