// ============================================
// DEPRECATED SHIM (BUG-HUNT R80 — unifikacija tenant modulov)
// ============================================
// Implementacija je zdaj v ENEM modulu: src/lib/tenant-scope.ts
// (skupni TENANT_ADMIN_ROLES, skupno NO_LOCATION_MESSAGE, en pravilnik
// za MODEL A katalog in transakcijske rute).
//
// Ta datoteka ostane SAMO kot re-export, da:
//   - barrel '@/lib/auth-middleware' deluje nespremenjeno,
//   - direktni importi '@/lib/auth-middleware/tenant-scope' ne gredo na tla.
// NOVE rute naj importirajo iz '@/lib/tenant-scope'.
// ============================================

export {
  resolveTenantLocationId,
  resolveTenantLocationIdOrThrow,
  tenantScopeToWhere,
} from '../tenant-scope'
export type { TenantScopeResult } from '../tenant-scope'
