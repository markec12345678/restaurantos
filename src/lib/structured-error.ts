// ─── R103: Strukturirane poslovne napake iz transaction telesa (canonical) ───
//
// FORENZIKA: R102 je vzorec uvedla lokalno za reservations modul
// (src/app/api/reservations/_helpers/structured-error.ts). R103 ga povzdigne
// v canonical knjižnično lokacijo, ker isti razred napak obstaja v tretjih
// modulih (gift-cards PUT tx body, staff-shifts POST tx body, time-entries
// POST tx body): `$transaction` telo meče strukturirane objekte
// `{ error: string, status: number }` — ti NISI Error instance, zato
// handleApiError jih obravnava kot neznane:
//   `error instanceof Error ? error.message : String(error)` → '[object Object]'
//   → 500 INTERNAL_ERROR (400/404/409 poslovni status se IZGUBI).
//
// Kontrakt: rute v catch bloku pokličejo structuredErrorResponse PRED
// handleApiError. Vzorec je closure-free in type-guarded (nikoli ne ujame
// pravih Error-jev / Prisma napak — te gredo naprej v handleApiError).
//
// POMANJLJIVO: throw-i iz tx teles MORAJO biti točno `{ error: string,
// status: number }` — kakršna koli razširitev (npr. extra polja) je dovoljena,
// ampak error mora biti string in status number, sicer padeta v 500 fallback.

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
