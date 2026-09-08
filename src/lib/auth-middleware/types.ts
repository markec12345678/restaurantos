// ============================================
// TIPI ZA AVTENTIKACIJSKI MIDDLEWARE
// Session interface + Permission tip
// ============================================

// Aktivne seje — hibridni pristop: pomnilniški cache + SQLite persistenca
export interface Session {
  token: string
  employeeId: string
  role: string
  permissions: string[]
  createdAt: number
  expiresAt: number
  absoluteExpiry: number  // Absolute max lifetime (24h)
  // FIX Test 7.1: Multi-tenant isolation — locationId za data scoping
  // Če je null, uporabnik vidi vse lokacije (admin/superuser)
  // Če je nastavljen, API-ji filtrirajo podatke po tej lokaciji
  locationId?: string | null
  // P1-11: Employee.sessionVersion ob prijavi — mismatch = takojšnja
  // revokacija (PIN sprememba / vloga / status / dovoljenja).
  sessionVersion?: number
}

// P1-13: Permission union izhaja IZKLJUČNO iz centralne matrike —
// prej je bil ročno podvojen ('void_item' ednina) in se ni ujemal z
// 'void_items' v json-fields/jobs → natakarjev storno je vedno padel s 403.
import type { PermissionName } from './permission-matrix'

export type Permission = PermissionName

export { ALL_PERMISSIONS, isPermissionName } from './permission-matrix'
