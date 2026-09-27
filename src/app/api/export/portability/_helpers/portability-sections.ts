// ============================================
// R147-b (epic #115 #34 Data portability) — SEKCIJE + SCOPE + CAPS
// ============================================
// buildPortabilitySections({ locationId, includeRows }) — 17 tabel v 5
// sekcijah (customers / menu / recipes / inventory / audit) z MODEL A scope:
//
//   • DIREKTNI spread (lastni locationId, pogojni — R86-4 kanon): Guest,
//     LoyaltyAccount, Reservation, WaitlistEntry, GuestFeedback, Menu,
//     ModifierGroup, TaxRate, InventoryItem, AuditLog — ko scope=locX, where
//     locationId=locX (NULL-location vrstice NE padajo v lokacijski izvoz —
//     fail-closed; vidne SAMO v globalnem izvozu super-admina, dokumentirano
//     v notes).
//   • RELACIJSKI spread (model BREZ lastnega locationId): GuestVisit
//     (guest.locationId), LoyaltyTransaction (loyaltyAccount.locationId),
//     Category (menu.locationId), MenuItem (category.menu.locationId),
//     Modifier (modifierGroup.locationId), RecipeItem
//     (menuItem.category.menu.locationId), StockTransaction
//     (inventoryItem.locationId) — LEAK-kanon R82 (nikoli filtrirati na
//     nivoju modela, ki nima stolpca).
//
// DETERMINIZEM (preverljivost — epic "tenant-scoped in preverljiv"):
//   • orderBy [{ createdAt: 'asc' }, { id: 'asc' }] na vseh tabelah;
//     AuditLog [{ timestamp: 'asc' }, { id: 'asc' }] (shema NIMA createdAt —
//     backup create.ts :111 vzorec),
//   • caps: 5000 vrstic na tabelo, revija 10000 — odrezek je determinističen,
//   • vrstice skozi encodeRowValues (reuse src/lib/backup/serialize — Decimal
//     → string, Date → ISO; IMPORT, NE fork — backup drill regresija).
//
// MANIFEST mode (includeRows=false): SAMO count({ where }) po tabeli —
// findMany se NE kliče (backup create.ts manifest vzorec :103).
// ============================================

import { db } from '@/lib/db'
import { encodeRowValues } from '@/lib/backup/serialize'
import {
  GUEST_SELECT,
  GUEST_VISIT_SELECT,
  LOYALTY_ACCOUNT_SELECT,
  LOYALTY_TRANSACTION_SELECT,
  RESERVATION_SELECT,
  WAITLIST_ENTRY_SELECT,
  GUEST_FEEDBACK_SELECT,
  MENU_SELECT,
  CATEGORY_SELECT,
  MENU_ITEM_SELECT,
  MODIFIER_GROUP_SELECT,
  MODIFIER_SELECT,
  TAX_RATE_SELECT,
  RECIPE_ITEM_SELECT,
  INVENTORY_ITEM_SELECT,
  STOCK_TRANSACTION_SELECT,
  AUDIT_LOG_SELECT,
} from './portability-selects'

// ── konstante (izvožene za teste) ──────────────────────────────────────────

/** Cap vrstic na tabelo — odrezek je determinističen (orderBy ustaljen). */
export const PORTABILITY_TABLE_CAP = 5000

/** Cap kurirane revije (AuditLog). */
export const PORTABILITY_AUDIT_CAP = 10000

/** Sekcije v fiksnem vrstnem redu (payload + X-Portability-Sections). */
export const PORTABILITY_SECTIONS = ['customers', 'menu', 'recipes', 'inventory', 'audit'] as const
export type PortabilitySection = (typeof PORTABILITY_SECTIONS)[number]

/**
 * Opombe v arhivu/manifestu — cross-referenci in izključitve (konstanta,
 * pinnana v testih).
 */
export const PORTABILITY_NOTES: string[] = [
  'Arhiv "restaurantos-portability" vsebuje poslovne podatke po lokacijah: gostje in zvestoba, rezervacije, čakanje, povratne informacije, meni z cenami in DDV, recepture, zaloga s knjigo premikov ter kurirana revija.',
  'Naročila, plačila, povračila, nabava, stroški in poročila NISO del tega arhiva — izvažajte jih prek Poročila → Izvoz (GET /api/reports/export?type=…, epic #33, CSV).',
  'Podatki zaposlenih so izključeni: GDPR Art. 15 izvoz na /api/gdpr/export/[employeeId], brisanje (Art. 17) na /api/gdpr/anonymize/[employeeId].',
  'Iz arhiva so IZKLJUČENE skrivnosti: PIN-i in seje zaposlenih, API ključi, WebAuthn/biometrija, FURS/CIS certifikati in gesla (RestaurantSettings); revija je kurirana (brez IP-naslovov in terminalov).',
  'Darilne kartice imajo ločen izvoz obveznosti (Runda 144); HACCP, Z-poročila in priprave niso del v1 arhiva.',
  'Vrstice brez dodeljene lokacije (locationId NULL — npr. skupna zaloga, legacy zapisi) so vključene SAMO v globalnem izvozu (brez ?locationId).',
  'Omejitve: do 5000 vrstic na tabelo (revija 10000); vrstni red je determinističen, izvoz za isti DB snapshot je preverljiv po checksumu.',
]

// ── tipi + where builderji ─────────────────────────────────────────────────

type LocationScope = string | null
type WhereRecord = Record<string, unknown>
type OrderBySpec = Array<Record<string, 'asc'>>
type SelectRecord = Record<string, true>

/** Pogojni spread za modele z lastnim (nullable) locationId — R86-4 kanon. */
function directWhere(locationId: LocationScope): WhereRecord {
  return locationId ? { locationId } : {}
}

/**
 * Relacijski scope: nested spread po poti (npr. 'guest' → { guest: { locationId } },
 * 'menuItem', 'category', 'menu' → { menuItem: { category: { menu: { locationId } } } }).
 * Brez scope-a (global) → {} (brez filtra).
 */
function relationalWhere(locationId: LocationScope, ...path: string[]): WhereRecord {
  if (!locationId) return {}
  let where: WhereRecord = { locationId }
  for (let i = path.length - 1; i >= 0; i--) {
    where = { [path[i]]: where }
  }
  return where
}

export interface PortabilityTableSpec {
  /** Prisma model (manifest/schema ime — ključ v counts/sections). */
  model: string
  /** Ime delegata na db klientu (db.<delegate>). */
  delegate: string
  section: PortabilitySection
  select: SelectRecord
  where: (locationId: LocationScope) => WhereRecord
  orderBy: OrderBySpec
  take: number
}

const DEFAULT_ORDER_BY: OrderBySpec = [{ createdAt: 'asc' }, { id: 'asc' }]
// AuditLog NIMA createdAt — backup create.ts :111 vzorec (timestamp, id).
const AUDIT_ORDER_BY: OrderBySpec = [{ timestamp: 'asc' }, { id: 'asc' }]

/**
 * Registry vseh 17 tabel v fiksnem vrstnem redu (5 sekcij). Poti relacijskega
 * scope-a so preverjene proti prisma/schema.prisma (R147-b):
 *   GuestVisit :2095 (brez locationId → guest), LoyaltyTransaction :1446
 *   (→ loyaltyAccount), Category :35 (→ menu), MenuItem :53 (→ category.menu),
 *   Modifier :145 (→ modifierGroup), RecipeItem :1314 (→ menuItem.category.menu),
 *   StockTransaction :1016 (FK inventoryItemId → inventoryItem).
 */
export const PORTABILITY_TABLES: PortabilityTableSpec[] = [
  // customers (7)
  { model: 'Guest', delegate: 'guest', section: 'customers', select: GUEST_SELECT, where: directWhere, orderBy: DEFAULT_ORDER_BY, take: PORTABILITY_TABLE_CAP },
  { model: 'GuestVisit', delegate: 'guestVisit', section: 'customers', select: GUEST_VISIT_SELECT, where: (loc) => relationalWhere(loc, 'guest'), orderBy: DEFAULT_ORDER_BY, take: PORTABILITY_TABLE_CAP },
  { model: 'LoyaltyAccount', delegate: 'loyaltyAccount', section: 'customers', select: LOYALTY_ACCOUNT_SELECT, where: directWhere, orderBy: DEFAULT_ORDER_BY, take: PORTABILITY_TABLE_CAP },
  { model: 'LoyaltyTransaction', delegate: 'loyaltyTransaction', section: 'customers', select: LOYALTY_TRANSACTION_SELECT, where: (loc) => relationalWhere(loc, 'loyaltyAccount'), orderBy: DEFAULT_ORDER_BY, take: PORTABILITY_TABLE_CAP },
  { model: 'Reservation', delegate: 'reservation', section: 'customers', select: RESERVATION_SELECT, where: directWhere, orderBy: DEFAULT_ORDER_BY, take: PORTABILITY_TABLE_CAP },
  { model: 'WaitlistEntry', delegate: 'waitlistEntry', section: 'customers', select: WAITLIST_ENTRY_SELECT, where: directWhere, orderBy: DEFAULT_ORDER_BY, take: PORTABILITY_TABLE_CAP },
  { model: 'GuestFeedback', delegate: 'guestFeedback', section: 'customers', select: GUEST_FEEDBACK_SELECT, where: directWhere, orderBy: DEFAULT_ORDER_BY, take: PORTABILITY_TABLE_CAP },
  // menu (6)
  { model: 'Menu', delegate: 'menu', section: 'menu', select: MENU_SELECT, where: directWhere, orderBy: DEFAULT_ORDER_BY, take: PORTABILITY_TABLE_CAP },
  { model: 'Category', delegate: 'category', section: 'menu', select: CATEGORY_SELECT, where: (loc) => relationalWhere(loc, 'menu'), orderBy: DEFAULT_ORDER_BY, take: PORTABILITY_TABLE_CAP },
  { model: 'MenuItem', delegate: 'menuItem', section: 'menu', select: MENU_ITEM_SELECT, where: (loc) => relationalWhere(loc, 'category', 'menu'), orderBy: DEFAULT_ORDER_BY, take: PORTABILITY_TABLE_CAP },
  { model: 'ModifierGroup', delegate: 'modifierGroup', section: 'menu', select: MODIFIER_GROUP_SELECT, where: directWhere, orderBy: DEFAULT_ORDER_BY, take: PORTABILITY_TABLE_CAP },
  { model: 'Modifier', delegate: 'modifier', section: 'menu', select: MODIFIER_SELECT, where: (loc) => relationalWhere(loc, 'modifierGroup'), orderBy: DEFAULT_ORDER_BY, take: PORTABILITY_TABLE_CAP },
  { model: 'TaxRate', delegate: 'taxRate', section: 'menu', select: TAX_RATE_SELECT, where: directWhere, orderBy: DEFAULT_ORDER_BY, take: PORTABILITY_TABLE_CAP },
  // recipes (1)
  { model: 'RecipeItem', delegate: 'recipeItem', section: 'recipes', select: RECIPE_ITEM_SELECT, where: (loc) => relationalWhere(loc, 'menuItem', 'category', 'menu'), orderBy: DEFAULT_ORDER_BY, take: PORTABILITY_TABLE_CAP },
  // inventory / stock ledger (2)
  { model: 'InventoryItem', delegate: 'inventoryItem', section: 'inventory', select: INVENTORY_ITEM_SELECT, where: directWhere, orderBy: DEFAULT_ORDER_BY, take: PORTABILITY_TABLE_CAP },
  { model: 'StockTransaction', delegate: 'stockTransaction', section: 'inventory', select: STOCK_TRANSACTION_SELECT, where: (loc) => relationalWhere(loc, 'inventoryItem'), orderBy: DEFAULT_ORDER_BY, take: PORTABILITY_TABLE_CAP },
  // audit (1)
  { model: 'AuditLog', delegate: 'auditLog', section: 'audit', select: AUDIT_LOG_SELECT, where: directWhere, orderBy: AUDIT_ORDER_BY, take: PORTABILITY_AUDIT_CAP },
]

/** Sortiran seznam modelov — schemaStamp determinizem (backup create.ts :137 vzorec). */
export const PORTABILITY_MODELS: string[] = PORTABILITY_TABLES.map((t) => t.model).sort()

// ── delegati ───────────────────────────────────────────────────────────────

/**
 * Strukturni tip delegata (backup manifest.ts BackupDelegate vzorec — Prisma
 * generični tipi so preozki za lohen registry; runtime oblika je ista).
 */
interface PortabilityDelegate {
  findMany: (args: {
    where: WhereRecord
    select: SelectRecord
    orderBy: OrderBySpec
    take: number
  }) => Promise<Array<Record<string, unknown>>>
  count: (args: { where: WhereRecord }) => Promise<number>
}

function tableDelegate(spec: PortabilityTableSpec): PortabilityDelegate {
  const value = (db as unknown as Record<string, unknown>)[spec.delegate]
  if (!value || typeof (value as PortabilityDelegate).findMany !== 'function') {
    throw new Error(`Portability: manjkajoči Prisma delegat za model ${spec.model} (db.${spec.delegate})`)
  }
  return value as PortabilityDelegate
}

// ── javni rezultat ─────────────────────────────────────────────────────────

/** table → izvožene (encodeRowValues) vrstice; manifest mode → po tabelah {} */
export type PortabilityRows = Record<PortabilitySection, Record<string, Array<Record<string, unknown>>>>
/** table → število vrstic (full: izvoženih pod cap; manifest: skupno v scope-u prek count()) */
export type PortabilityCounts = Record<PortabilitySection, Record<string, number>>

export interface PortabilityData {
  sections: PortabilityRows
  counts: PortabilityCounts
  totalCount: number
  tableCount: number
  sectionCount: number
}

/**
 * Zgradi sekcije portability arhiva za MODEL A scope.
 * includeRows=true  → findMany (select whitelist + orderBy + take) + encodeRowValues;
 * includeRows=false → SAMO count({ where }) po tabeli (manifest mode).
 */
export async function buildPortabilitySections(opts: {
  locationId: LocationScope
  includeRows: boolean
}): Promise<PortabilityData> {
  const { locationId, includeRows } = opts

  const sections = {} as PortabilityRows
  const counts = {} as PortabilityCounts
  for (const section of PORTABILITY_SECTIONS) {
    sections[section] = {}
    counts[section] = {}
  }

  let totalCount = 0
  for (const spec of PORTABILITY_TABLES) {
    const where = spec.where(locationId)
    const delegate = tableDelegate(spec)
    if (includeRows) {
      const rows = await delegate.findMany({
        where,
        select: spec.select,
        orderBy: spec.orderBy,
        take: spec.take,
      })
      const encoded = rows.map((row) => encodeRowValues(row as Record<string, unknown>))
      sections[spec.section][spec.model] = encoded
      counts[spec.section][spec.model] = encoded.length
      totalCount += encoded.length
    } else {
      const n = await delegate.count({ where })
      counts[spec.section][spec.model] = n
      totalCount += n
    }
  }

  return {
    sections,
    counts,
    totalCount,
    tableCount: PORTABILITY_TABLES.length,
    sectionCount: PORTABILITY_SECTIONS.length,
  }
}
