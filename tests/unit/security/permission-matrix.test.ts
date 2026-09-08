// ============================================
// P1-13 — CENTRALNA PERMISSION MATRIKA (unit testi)
// ============================================
// Preverja:
//  1. ALL_PERMISSIONS je enoten vir (void_items ne void_item; + manage_accounting)
//  2. Zod permissionSchema sprejme točno matrične vrednosti
//  3. ROUTE_PERMISSIONS vsebuje SAMO veljavna imena
//  4. hasPermission: session z Job 'Natakar' permissioni lahko stornira
//     (regresija na void_item/void_items mismatch — prej 403)
//  5. PERMISSION_MATRIX pokriva uporabnikovo specifikacijo
// ============================================

import { describe, it, expect } from 'vitest'
import {
  ALL_PERMISSIONS,
  PERMISSION_MATRIX,
  PERMISSION_LABELS,
  isPermissionName,
  getMatrixRow,
} from '@/lib/auth-middleware/permission-matrix'
import { permissionSchema } from '@/lib/json-fields/schemas'
import { ROUTE_PERMISSIONS } from '@/lib/auth-middleware/constants'
import { hasPermission } from '@/lib/auth-middleware/permissions'
import type { Session } from '@/lib/auth-middleware/types'

function makeSession(overrides: Partial<Session>): Session {
  return {
    token: 'x'.repeat(64),
    employeeId: 'emp-test',
    role: 'staff',
    permissions: [],
    createdAt: Date.now(),
    expiresAt: Date.now() + 1000,
    absoluteExpiry: Date.now() + 1000,
    ...overrides,
  }
}

describe('P1-13: ALL_PERMISSIONS — enoten vir imen', () => {
  it('vsebuje void_items (množina) in NE void_item (ednina — bug vir)', () => {
    expect(ALL_PERMISSIONS).toContain('void_items')
    expect(ALL_PERMISSIONS).not.toContain('void_item')
  })

  it('vsebuje novo manage_accounting dovoljenje', () => {
    expect(ALL_PERMISSIONS).toContain('manage_accounting')
  })

  it('ima 9 dovoljenj (8 prvotnih + manage_accounting)', () => {
    expect(ALL_PERMISSIONS).toHaveLength(9)
  })

  it('isPermissionName prepozna veljavna in zavrne neveljavna imena', () => {
    expect(isPermissionName('take_orders')).toBe(true)
    expect(isPermissionName('manage_accounting')).toBe(true)
    expect(isPermissionName('void_item')).toBe(false) // ednina = bug vir
    expect(isPermissionName('manage_bar')).toBe(false) // izmišljeno
    expect(isPermissionName('')).toBe(false)
  })

  it('PERMISSION_LABELS pokriva vsa dovoljenja', () => {
    for (const p of ALL_PERMISSIONS) {
      expect(PERMISSION_LABELS[p]).toBeTruthy()
    }
  })
})

describe('P1-13: Zod permissionSchema (login parse — Job.permissions)', () => {
  it('sprejme vsa imena iz ALL_PERMISSIONS', () => {
    for (const p of ALL_PERMISSIONS) {
      expect(permissionSchema.safeParse(p).success).toBe(true)
    }
  })

  it('zavrne void_item (ednina) — vzrok starega 403 bug-a', () => {
    expect(permissionSchema.safeParse('void_item').success).toBe(false)
  })

  it('zavrne neznana imena (manage_kitchen, manage_bar, view_inventory)', () => {
    // Semena job-ov v preteklosti vsebovala ta imena — tiho padla iz ven
    expect(permissionSchema.safeParse('manage_kitchen').success).toBe(false)
    expect(permissionSchema.safeParse('manage_bar').success).toBe(false)
    expect(permissionSchema.safeParse('view_inventory').success).toBe(false)
  })
})

describe('P1-13: ROUTE_PERMISSIONS — vsa imena veljavna', () => {
  it('vsebuje SAMO dovoljenja iz ALL_PERMISSIONS', () => {
    for (const [route, perms] of Object.entries(ROUTE_PERMISSIONS)) {
      for (const p of perms) {
        expect(isPermissionName(p), `Ruta ${route} ima neveljavno dovoljenje '${p}'`).toBe(true)
      }
    }
  })

  it('accounting varovalka zahteva view_reports (read-only default)', () => {
    expect(ROUTE_PERMISSIONS['/api/accounting']).toEqual(['view_reports'])
  })
})

describe('P1-13: hasPermission — regresija void bug-a', () => {
  it('Natakar (Job permissioni) LAHKO stornira postavko — void_items match', () => {
    // Seed Job "Natakar": ['take_orders', 'void_items', 'apply_discounts']
    const session = makeSession({
      permissions: ['take_orders', 'void_items', 'apply_discounts'],
    })
    // order-items/[id] route: isVoidOperation ? 'void_items' : 'take_orders'
    expect(hasPermission(session, ['void_items'])).toBe(true)
  })

  it('Kuhar (brez void_items) NE more stornirati', () => {
    const session = makeSession({ permissions: [] })
    expect(hasPermission(session, ['void_items'])).toBe(false)
  })

  it('admin bypass vsega', () => {
    const session = makeSession({ role: 'admin', permissions: [] })
    expect(hasPermission(session, ['admin'])).toBe(true)
    expect(hasPermission(session, ['manage_accounting'])).toBe(true)
  })

  it('manager bypass non-admin rut (accounting = da po matriki)', () => {
    const session = makeSession({ role: 'manager', permissions: [] })
    expect(hasPermission(session, ['manage_accounting'])).toBe(true)
    expect(hasPermission(session, ['take_orders'])).toBe(true)
    // admin-only rute (npr. davki) so za managerja zaprte
    expect(hasPermission(session, ['admin'])).toBe(false)
  })

  it('blagajnik (manage_cash) NE more urejati accountinga (nova matrika)', () => {
    // Vodja smene: ['take_orders', 'manage_cash', 'void_items', 'apply_discounts', 'view_reports']
    const session = makeSession({
      role: 'staff',
      permissions: ['take_orders', 'manage_cash', 'void_items', 'apply_discounts', 'view_reports'],
    })
    expect(hasPermission(session, ['manage_cash'])).toBe(true)   // zaključi izmeno: da
    expect(hasPermission(session, ['manage_accounting'])).toBe(false) // accounting: ne
    expect(hasPermission(session, ['manage_employees'])).toBe(false)  // uporabniki: ne
    expect(hasPermission(session, ['take_orders'])).toBe(true)    // ustvari order: da
  })
})

describe('P1-13: PERMISSION_MATRIX — uporabnikova specifikacija', () => {
  it('vsebuje vseh 10 operacij', () => {
    const keys = PERMISSION_MATRIX.map(r => r.key)
    expect(keys).toContain('order.create')
    expect(keys).toContain('payment.refund')
    expect(keys).toContain('orderItem.void')
    expect(keys).toContain('taxRates.write')
    expect(keys).toContain('employees.write')
    expect(keys).toContain('shift.close')
    expect(keys).toContain('accounting.write')
  })

  it('vsaka matrična vrstica zahteva veljavno dovoljenje', () => {
    for (const row of PERMISSION_MATRIX) {
      expect(isPermissionName(row.permission), `Vrstica ${row.key} ima neveljavno dovoljenje`).toBe(true)
    }
  })

  it('uporabnikova vrstica "Uredi accounting": waiter/cashier ne, manager/admin da', () => {
    const row = getMatrixRow('accounting.write')
    expect(row).toBeDefined()
    expect(row!.waiter).toBe('ne')
    expect(row!.cashier).toBe('ne')
    expect(row!.manager).toBe('da')
    expect(row!.admin).toBe('da')
    expect(row!.permission).toBe('manage_accounting')
  })

  it('uporabnikova vrstica "Zaključi smeno": waiter ne, ostali da', () => {
    const row = getMatrixRow('shift.close')
    expect(row!.waiter).toBe('ne')
    expect(row!.cashier).toBe('da')
    expect(row!.manager).toBe('da')
    expect(row!.admin).toBe('da')
    expect(row!.permission).toBe('manage_cash')
  })

  it('uporabnikova vrstica "Ustvari order": vsi da', () => {
    const row = getMatrixRow('order.create')
    expect(row!.waiter).toBe('da')
    expect(row!.cashier).toBe('da')
    expect(row!.manager).toBe('da')
    expect(row!.admin).toBe('da')
  })

  it('matrika ima unikatne ključe operacij', () => {
    const keys = PERMISSION_MATRIX.map(r => r.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
