// ============================================
// KDS OPOMNIK — NEVARNA CONA (ESKALACIJA)
// ============================================
// Runda 64: naročila, ki čakajo ≥ 25 min (danger cona — iste meje kot
// rdeči OrderCard), dobijo zvočni opomnik vsakih 60 s, dokler kuhar
// nekaj ne bumpne. Prej je bil opomin VIZUALEN samo (rdeči utrip kartice)
// — kuhar, ki gleda drugam, ga ne sliši.
//
// Čista logika v lib (testabilna), zvok/hook sta tanek ovoj:
//   • shouldRemind — enostavno odločitveno pravilo (interval + pogoji)
//   • countDangerOrders — števec za čip v glavi
//
// Spoštuje R63 preferenco zvoka (enabled param) — utišan zaslon ne opominja.
// ============================================

/** Opomnik vsakih 60 s — dovolj pesimistično, da ne jezi kuharja. */
export const KDS_REMINDER_INTERVAL_MS = 60_000

/** Notranji pregledni tiktak — pogostejši od intervala (odzvnost), vendar poceni. */
export const KDS_REMINDER_CHECK_MS = 15_000

/** Meja nevarne cone v minutah — ENAKA kot rdeča meja OrderCard (25 min). */
export const KDS_DANGER_MINUTES = 25

/**
 * Število naročil v nevarni coni (elapsed v minutah ≥ prag).
 * Pozitivni elapsed samo — prihodnji firedAt (urni zamik) ne šteje.
 */
export function countDangerOrders(
  elapsedMinutes: number[],
  threshold: number = KDS_DANGER_MINUTES
): number {
  let count = 0
  for (const m of elapsedMinutes) {
    if (m >= threshold) count++
  }
  return count
}

/**
 * Odločitev za opomnik: zvok vklopljen + vsaj 1 naročilo v nevarni coni +
 * minil interval (ali prvi pregled — lastRemindMs = 0 → takoj, ker je
 * naročilo ALI že predolgo čakalo).
 */
export function shouldRemind(
  nowMs: number,
  lastRemindMs: number,
  dangerCount: number,
  enabled: boolean
): boolean {
  if (!enabled || dangerCount <= 0) return false
  return nowMs - lastRemindMs >= KDS_REMINDER_INTERVAL_MS
}
