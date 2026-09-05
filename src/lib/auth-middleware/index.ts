// ============================================
// AVTENTIKACIJSKI MIDDLEWARE — barrel re-export
// Vsi uvozi `@/lib/auth-middleware` še vedno delujejo
// ============================================

// Tipi
export type { Session, Permission } from './types'

// Tenant scope resolver (multi-tenant isolation)
export {
  resolveTenantLocationId,
  resolveTenantLocationIdOrThrow,
  tenantScopeToWhere,
} from './tenant-scope'
export type { TenantScopeResult } from './tenant-scope'

// Upravljanje sej
export { createSession, verifyToken, destroySession, invalidateEmployeeStatusCache } from './session-store'

// Middleware funkciji
export { requireAuth, optionalAuth } from './middleware'
