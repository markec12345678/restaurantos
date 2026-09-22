// ============================================
// AS ARRAY — varna normalizacija v ARRAY (R71, QA-vojen fix)
// ============================================
// Problema: produkcija je imela crash "(m || []).map is not a function"
// (POS:configuration, 2026-09-19 14:44). Vzorec `(x || []).map` NE ščiti,
// kadar je x resničen (truthy) ampak NI array — npr. API vrne
// `{ priceGroups: [...] }` namesto `[...]` (R69 Happy Hour crash!), paginiran
// odgovor `{ data, total }`, ali string. `|| []` zamenja samo null/undefined,
// objekt pade skozi in .map eksplodira.
//
// REŠITEV: enoten vir — asArray() vrača vhod SAMO če je Array.isArray,
// sicer prazen array. Zamenjaj `(x || [])` na mestih, kjer vhod prihaja
// iz API-ja/db in oblika ni 100 % zagarantirana.
// ============================================

/** Vrne vhod, kadar je pravi array, sicer prazen array (fail-safe).
 *  T se razreši iz konteksta klica (npr. `.map((tx: TransactionData) => …)`
 *  ali prireditveni tip) — parameter je namenoma `unknown`, ker je točka
 *  ravno v RUNTIME obliki, ki je TS ne vidi (API kršitev sheme). */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}
