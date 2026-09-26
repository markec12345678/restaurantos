'use client'

// =====================================================================
// Driver kontekst — žeton + authFetch (R137-c, epic #115 P1-13).
//
// KDS kanon (use-kds-orders.ts:24-26): staff Bearer žeton iz treh
// shramb — standalone PIN prijava (KDSLogin/voznik) piše v localStorage
// 'pos_token', POS shell seja pa v 'pos_auth_token' (session/local).
// Vrstni red branja: lastna voznikova prijava ima prednost pred POS
// sejo (isti telefon = isti voznik).
// =====================================================================

const TOKEN_PRIMARY = 'pos_token'      // standalone PIN prijava (KDSLogin kanon)
const TOKEN_SESSION = 'pos_auth_token' // POS shell seja — sessionStorage
const TOKEN_LOCAL = 'pos_auth_token'   // POS shell seja — localStorage

/** Poišči veljavni staff žeton (driver prijava ima prednost pred POS sejo) */
export function getStoredToken(): string | null {
  try {
    return (
      localStorage.getItem(TOKEN_PRIMARY) ||
      sessionStorage.getItem(TOKEN_SESSION) ||
      localStorage.getItem(TOKEN_LOCAL) ||
      null
    )
  } catch {
    return null // brez shrambe (private mode) — obravnavaj kot odjavljen
  }
}

/** Shrani žeton standalone PIN prijave (KDSLogin kanon: 'pos_token') */
export function setStoredToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_PRIMARY, token)
  } catch {
    // brez shrambe — tiho; login forma pokaže napako ob naslednjem klicu
  }
}

/** Počisti vse znane lokacije žetona (logout / 401) */
export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_PRIMARY)
    sessionStorage.removeItem(TOKEN_SESSION)
    localStorage.removeItem(TOKEN_LOCAL)
  } catch {
    // brez shrambe — nič za čiščenje
  }
}

/** 401 med pollom/akcijo → seja ni več veljavna (žeton počiščen, re-login) */
export class UnauthorizedError extends Error {
  constructor() {
    super('Seja je potekla')
    this.name = 'UnauthorizedError'
  }
}

/** fetch z Bearer žetonom; 401 → počisti žeton + vrže UnauthorizedError */
export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = getStoredToken()
  const headers = new Headers(init?.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(url, { ...init, headers })
  if (res.status === 401) {
    clearStoredToken()
    throw new UnauthorizedError()
  }
  return res
}

/** POST JSON s Bearer žetonom (self-claim / statusni prehodi) */
export function authPostJson(url: string, body: unknown): Promise<Response> {
  return authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Izvleči { error } sporočilo iz odgovora (400/403/404/409 oblike { error }) */
export function extractErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'error' in data) {
    const err = (data as { error: unknown }).error
    if (typeof err === 'string' && err !== '') return err
  }
  return fallback
}
