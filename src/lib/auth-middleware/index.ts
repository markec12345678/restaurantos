// ============================================
// AVTENTIKACIJSKI MIDDLEWARE — barrel re-export
// Vsi uvozi `@/lib/auth-middleware` še vedno delujejo
// ============================================

// Tipi
export type { Session, Permission } from './types'

// Upravljanje sej
export { createSession, verifyToken, destroySession } from './session-store'

// Middleware funkciji
export { requireAuth, optionalAuth } from './middleware'
