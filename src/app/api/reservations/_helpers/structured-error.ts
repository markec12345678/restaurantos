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

import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-utils'

export function structuredErrorResponse(
  error: unknown,
  context: string,
  fallbackMessage: string,
): NextResponse {
  if (
    error &&
    typeof error === 'object' &&
    'error' in error &&
    'status' in error &&
    typeof (error as { error: unknown }).error === 'string' &&
    typeof (error as { status: unknown }).status === 'number'
  ) {
    const structured = error as { error: string; status: number }
    return NextResponse.json({ error: structured.error }, { status: structured.status })
  }
  return handleApiError(error, context, fallbackMessage)
}
