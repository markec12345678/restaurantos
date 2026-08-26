// ============================================
// PIN LOGIN — Skupne konstante in tipi
// ============================================

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
