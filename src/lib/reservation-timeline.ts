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
