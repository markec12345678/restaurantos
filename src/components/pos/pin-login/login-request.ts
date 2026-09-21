// ============================================
// LOGIN REQUEST — čista oddaja prijave (R95-b)
// ============================================
//
// Izvlečeno iz usePinLogin mutationFn-a za testabilnost (runda 25 vzorec:
// čisti helperji ločeni od hookov — unit testi pinajo fetch body JSON in
// offline pot brez react-query/rendererja). Logika je 1:1 z nekdaj inline
// verzijo (rounda 5 offline-first prijava).
//
// R95-a FROZEN KONTRAKT (POST /api/auth):
//   - body { pin, employeeId? } — employeeId PODAN = strog binding (PIN mora
//     pripadati IZBRANEMU zaposlenemu, sicer enoten 401, zero oracle);
//   - employeeId ODSOTEN = legacy deterministični lastnik PIN-a (E2E
//     EDGE-4/15 single-step kontrakt ostaja zelen).
// Odgovor nespremenjen: { success, employee, token, message }.

import { verifyOfflinePin } from './offline-auth'
import type { AuthUser } from './constants'

export interface LoginResult {
  employee: AuthUser
  message: string
  token?: string
  offline?: boolean
}

export type LoginRequestBody = { pin: string } | { pin: string; employeeId: string }

/**
 * Sestavi body za POST /api/auth.
 * Single-step (employeeId undefined/empty) → ključ IZKLJUČNO izpuščen
 * (ne pošiljaj smeti; Zod sicer stripa, ampak kontrakt je jasen).
 */
export function buildLoginBody(pin: string, employeeId?: string): LoginRequestBody {
  if (typeof employeeId === 'string' && employeeId.length > 0) {
    return { pin, employeeId }
  }
  return { pin }
}

/** Mrežna napaka (strežnik ni dosegljiv) → edina pot do offline fallbacka. */
export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError || (err instanceof Error && err.message.includes('fetch'))
}

/**
 * Offline fallback — PIN-ONLY (namenoma IGNORIRA employeeId): cached device
 * session je PIN-vezan (SHA-256 verifikator v offline-auth.ts), v
 * dvostopenjskem toku pa je izbrani zaposleni vseeno ista oseba, katere PIN
 * je session cache-al. Zato tukaj ni employeeId bindinga.
 */
async function offlineFallback(pin: string): Promise<LoginResult> {
  const offline = await verifyOfflinePin(pin).catch(() => null)
  if (offline) {
    return {
      employee: offline.employee,
      message: `Offline prijava (${Math.ceil(offline.expiresInMs / 3600000)} h veljavnosti) — naročila gredo na strežnik ob povezavi`,
      offline: true,
    }
  }
  throw new Error('Strežnik ni dosegljiv in offline prijava ni mogoča — prijavite se enkrat z mrežo')
}

type FetchLike = typeof fetch

/**
 * Online prijava z offline fallbackom (nekdanja mutationFn logika).
 * fetchImpl je injektiran samo za teste (privzeto globalni fetch).
 */
export async function performLogin(
  pin: string,
  employeeId: string | undefined,
  fetchImpl: FetchLike = fetch,
): Promise<LoginResult> {
  let res: Response
  try {
    res = await fetchImpl('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildLoginBody(pin, employeeId)),
    })
  } catch (err) {
    // Strežnik ni dosegljiv (mrežna napaka) → offline fallback
    if (isNetworkError(err)) return offlineFallback(pin)
    throw err
  }
  if (!res.ok) {
    let message = 'Napaka pri prijavi'
    try {
      const data = await res.json() as { error?: string }
      if (data?.error) message = data.error
    } catch {
      // ne-JSON odgovor (proxy stran, prazno telo) — ostani pri splošnem sporočilu
    }
    // Napačen PIN pri DOSEGLJIVEM strežniku = prava napaka (ne offline fallback!)
    throw new Error(message)
  }
  return res.json() as Promise<LoginResult>
}
