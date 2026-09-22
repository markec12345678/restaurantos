// ─── R102: Strukturirane poslovne napake iz transaction telesa ───
//
// FORENZIKA: create-handler (FIX #3, Runda 40) meče iz $transaction telesa
// strukturirane objekte `{ error: string, status: number }` (404 miza izgubljena
// mid-flight, 400 kapaciteta, 409 overlap, 409 P2034 concurrent-create). Ti
// objekti NISI Error instance — handleApiError jih obravnava kot neznane napake:
//   `error instanceof Error ? error.message : String(error)` → '[object Object]'
//   → 500 INTERNAL_ERROR (v produkciji generično sporočilo, 409/404/400 se
//   IZGUBIJO — klient nikoli ni videl "drug uporabnik je rezerviral to mizo").
//
// R102 FIX: rute reservations modula preslišijo strukturirane objekte PRED
// handleApiError — poslovni status (400/404/409) končno doseže klienta.
// Vzorec je closure-free in type-guarded (nikoli ne ujame pravih Error-jev).
//
// R103: implementacija POVZDIGNEA v canonical src/lib/structured-error.ts
// (isti razred napak zdaj pokrit v gift-cards/staff-shifts/time-entries).
// Ta datoteka ostane kot re-export za obstoječe R102 uvoze + teste.

export { structuredErrorResponse } from '@/lib/structured-error'
