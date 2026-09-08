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

export type Permission =
  | 'take_orders'
  | 'void_item'
  | 'apply_discounts'
  | 'manage_cash'
  | 'manage_inventory'
  | 'manage_employees'
  | 'view_reports'
  | 'admin'
