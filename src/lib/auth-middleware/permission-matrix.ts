// ============================================
// CENTRALNA PERMISSION MATRIKA (P1-13)
// ============================================
// EDINI vir resnice za vsa imena dovoljenj v sistemu.
//
// Prej so bila imena permissionov raztresena po 6+ datotekah
// (auth-middleware/types.ts, json-fields/schemas.ts, json-fields/index.ts,
// jobs/[id]/route.ts, setup/init, seed) — kar je povzročilo kritični bug:
// types.ts je imel 'void_item' (ednina), jobs/shema pa 'void_items' (množina)
// → natakar z void_items dovoljenjem je ob poskusu storna dobil 403,
// ker je API preverjal 'void_item' in se ključ nikoli ni ujemal.
//
// Sedaj vsi ti moduli uvozijo ALL_PERMISSIONS / PermissionName od tu.
//
// MATRIKA (operacija × vloga) — vzorec po uporabnikovi specifikaciji:
// Vlogam v RESTaurantOS ne ustrezajo fiksni "Waiter/Cashier" role-i, ampak
// delovna mesta (Job) s seznamom permissionov + role bypass:
//   - role 'admin'    → bypass vsega
//   - role 'manager'  → bypass vsega razen admin-only rut
//   - role 'staff'    → SAMO permissioni iz svojih Job-ov
// Tipična preslikava:
//   Waiter  = Job "Natakar"     (take_orders, void_items, apply_discounts)
//   Cashier = Job z manage_cash (npr. "Vodja smene" / "Blagajnik")
//   Manager = role 'manager'
//   Admin   = role 'admin'
// ============================================

/** Vsa veljavna imena dovoljenj — enkrat, centralno. */
export const ALL_PERMISSIONS = [
  'take_orders',        // ustvarjanje naročil, meniji, mize, dostava
  'void_items',         // storno postavk naročila
  'apply_discounts',    // popusti, happy hour
  'manage_cash',        // plačila, povračila, blagajna, zaključek izmene
  'manage_inventory',   // zaloga, nabava, dobavitelji, recepti
  'manage_employees',   // zaposleni, funkcije, razporedi
  'manage_accounting',  // P1-13: knjigovodstvo (kontni načrt, AP/AR) — Manager/Admin
  'view_reports',       // poročila, nadzorne plošče
  'admin',              // popoln dostop (konfiguracija, fiskalizacija, integracije)
] as const

export type PermissionName = (typeof ALL_PERMISSIONS)[number]

/** Slovenski nazivi za UI. */
export const PERMISSION_LABELS: Record<PermissionName, string> = {
  take_orders: 'Jemanje naročil',
  void_items: 'Storno postavk',
  apply_discounts: 'Odobritev popustov',
  manage_cash: 'Blagajniška operacija',
  manage_inventory: 'Upravljanje zaloge',
  manage_employees: 'Upravljanje zaposlenih',
  manage_accounting: 'Knjigovodstvo',
  view_reports: 'Ogled poročil',
  admin: 'Administrator',
}

/**
 * Matrica operacija (P1-13 specifikacija) → zahtevan permission.
 *
 * 'da'        = vloga ima dovoljenje (prek Job permissionov ali role bypassa)
 * 'ne'        = vloga NIMA dovoljenja — API vrne 403
 * 'omejeno'   = delno: veljajo dodatne varovalke (npr. delno povračilo,
 *               admin-only eskalacija, transakcijska varovalka proti double-close)
 *
 | Operacija           | Waiter | Cashier | Manager | Admin | Permission            |
 |---------------------|--------|---------|---------|-------|-----------------------|
 | Ustvari order       | da     | da      | da      | da    | take_orders           |
 | Refund              | ne     | omejeno | da      | da    | manage_cash           |
 | Storno postavke     | da*    | da*     | da      | da    | void_items            |
 | Spremeni davke      | ne     | ne      | ne      | da    | admin                 |
 | Uredi uporabnike    | ne     | ne      | omejeno | da    | manage_employees      |
 | Zaključi smeno      | ne     | da      | da      | da    | manage_cash           |
 | Uredi accounting    | ne     | ne      | da      | da    | manage_accounting     |
 | Uredi zalogo        | ne     | ne      | da      | da    | manage_inventory      |
 | Popusti             | da*    | da*     | da      | da    | apply_discounts       |
 | Poročila            | ne     | ne      | da      | da    | view_reports          |
 *
 * *da le, če Job vsebuje ta permission (Natakar ga ima privzeto).
 * Opomba: davki so strožje kot v vzorčni matriki (admin-only namesto
 * "manager: omejeno") — sprememba DDV stopelj je fiskalno občutljiva;
 * manager jih vidi v poročilih, spreminja pa samo admin.
 */
export interface MatrixRow {
  /** Ključ operacije (stabilen — za UI in teste) */
  key: string
  /** Slovenski naziv operacije */
  operation: string
  /** Zahtevan permission v API-ju (preverjen s requireAuth) */
  permission: PermissionName
  /** Pokritost po vlogah (dokumentacija + UI prikaz) */
  waiter: 'da' | 'ne' | 'omejeno'
  cashier: 'da' | 'ne' | 'omejeno'
  manager: 'da' | 'ne' | 'omejeno'
  admin: 'da' | 'ne' | 'omejeno'
}

export const PERMISSION_MATRIX: MatrixRow[] = [
  {
    key: 'order.create', operation: 'Ustvari naročilo', permission: 'take_orders',
    waiter: 'da', cashier: 'da', manager: 'da', admin: 'da',
  },
  {
    key: 'payment.refund', operation: 'Povračilo plačila', permission: 'manage_cash',
    waiter: 'ne', cashier: 'omejeno', manager: 'da', admin: 'da',
    // omejeno (Cashier): delno povračilo validirano ZNOTRAJ zaklepne transakcije
    // (pg_advisory_xact_lock) — dva vzporedna refunda ne moreta povrniti dvakrat
  },
  {
    key: 'orderItem.void', operation: 'Storno postavke', permission: 'void_items',
    waiter: 'da', cashier: 'da', manager: 'da', admin: 'da',
  },
  {
    key: 'taxRates.write', operation: 'Spremeni davčne stopnje', permission: 'admin',
    waiter: 'ne', cashier: 'ne', manager: 'ne', admin: 'da',
  },
  {
    key: 'employees.write', operation: 'Uredi uporabnike', permission: 'manage_employees',
    waiter: 'ne', cashier: 'ne', manager: 'omejeno', admin: 'da',
    // omejeno (Manager): vse razen kreiranja admin vloge (403 če ni admin role)
  },
  {
    key: 'shift.close', operation: 'Zaključi izmeno (blagajna)', permission: 'manage_cash',
    waiter: 'ne', cashier: 'da', manager: 'da', admin: 'da',
    // transakcijska varovalka: double-close vrne 409
  },
  {
    key: 'accounting.write', operation: 'Uredi knjigovodstvo', permission: 'manage_accounting',
    waiter: 'ne', cashier: 'ne', manager: 'da', admin: 'da',
    // P1-13 poprej: manage_cash (blagajnik je lahko urejal kontni načrt!)
  },
  {
    key: 'inventory.write', operation: 'Uredi zalogo', permission: 'manage_inventory',
    waiter: 'ne', cashier: 'ne', manager: 'da', admin: 'da',
  },
  {
    key: 'discounts.apply', operation: 'Odobri popust', permission: 'apply_discounts',
    waiter: 'da', cashier: 'da', manager: 'da', admin: 'da',
  },
  {
    key: 'reports.view', operation: 'Ogled poročil', permission: 'view_reports',
    waiter: 'ne', cashier: 'ne', manager: 'da', admin: 'da',
  },
]

/** Poišči vrstico matrike po ključu operacije. */
export function getMatrixRow(key: string): MatrixRow | undefined {
  return PERMISSION_MATRIX.find(r => r.key === key)
}

/** Preveri, da je vrednost veljavno ime dovoljenja (runtime guard). */
export function isPermissionName(value: string): value is PermissionName {
  return (ALL_PERMISSIONS as readonly string[]).includes(value)
}
