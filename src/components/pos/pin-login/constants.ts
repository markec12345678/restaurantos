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
