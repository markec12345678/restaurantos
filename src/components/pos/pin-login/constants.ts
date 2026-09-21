// ============================================
// PIN LOGIN — Skupne konstante in tipi
// ============================================

// --- KONSTANTE ---

/** Največja dolžina PIN-a (runda 25: izvlečeno iz magične 6 v usePinLogin) */
export const PIN_MAX_LENGTH = 6

/** Najmanjša dolžina PIN-a (enotna z validacijo na strežniku) */
export const PIN_MIN_LENGTH = 4

// --- TIPI ---

/** Podatkovni tip za prijavljenega uporabnika */
export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  primaryJob: { id: string; name: string; payRate: number } | null
  permissions: string[]
}

// --- R95-b: DVOSTOPENJSKA PRIJAVA (izbira zaposlenega → PIN) ---

/**
 * Korak prijavnega toka:
 *   'select' = korak 1 (grid zaposlenih, dvostopenjski tok aktiven),
 *   'pin'    = korak 2 (PIN za IZBRANEGA zaposlenega — body dobi employeeId),
 *   'single' = legacy PIN-only zaslon (privzeto, brez device lokacije —
 *              E2E kompatibilnost: /?PIN prijava ostane točno kot danes).
 */
export type LoginStep = 'select' | 'pin' | 'single'

/** Vrstica v gridu izbire — { id, name, role } (R95-a frozen kontrakt, minimalen PII) */
export interface EmployeeOption {
  id: string
  name: string
  role: string
}

/** Odgovor GET /api/auth/employees?locationId=<id> (R95-a frozen kontrakt) */
export interface EmployeesResponse {
  location: { id: string; name: string }
  employees: EmployeeOption[]
}

/** Izbrani zaposleni (korak 2 — UI potrebuje samo id + ime) */
export interface SelectedEmployee {
  id: string
  name: string
}

/**
 * LOKALNA hierarhična query tipka (vzorec R89-2) — globalnega
 * src/lib/query-keys fajla NE urejamo (lastninska lista R95-b).
 * deviceLocationId je del tipke: različne lokacije = različni cache vnosi.
 */
export const authEmployeesQueryKey = (deviceLocationId: string | null) =>
  ['auth', 'employees', deviceLocationId] as const

/**
 * Muted notice ob 404/429/mrežni napaki/praznem seznamu employees endpointa.
 * Fail-open na UX (NE na varnost — employeeId binding je optional): prijava
 * z PIN-om mora ostati vedno mogoča (super-admini / NULL-lokacijski).
 */
export const EMPLOYEE_SELECT_UNAVAILABLE = 'Izbira zaposlenih ni na voljo'

// --- PROPS INTERFACI ZA POD-KOMPONENTE ---

export interface PinLoginProps {
  onLogin: (_user: AuthUser) => void
  onSkip?: () => void
}

export interface PinDisplayProps {
  pinLength: number
}

export interface PinKeypadProps {
  onDigit: (_digit: string) => void
  onBackspace: () => void
  onSubmit: () => void
  disabled: boolean
  firstDigitRef: React.RefObject<HTMLButtonElement | null>
}

export interface EmployeeSelectStepProps {
  employees: EmployeeOption[]
  /** Ime lokacije za badge (Store ikona) — od employees odgovora */
  locationName?: string
  isLoading: boolean
  /** 404/429/omrežna napaka → komponenta pokaže notice namesto grida (fail-open) */
  isError: boolean
  onEmployeeSelect: (_employee: SelectedEmployee) => void
  /** Preklop na single-step PIN-only (super-admini / NULL-lokacijski zaposleni) */
  onPinOnly: () => void
}
