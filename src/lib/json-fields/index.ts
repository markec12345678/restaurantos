// ============================================
// JSON FIELDS — Central typed layer for JSON-as-String fields
//
// ISSUE #33: OrderItem.modifiersJson + 20 JSON-as-String polj.
// R150 (#33 Phase 3 KONČAN): 25 stolpcev je zdaj Prisma Json (JSONB) —
// migracija 0022_json_fields. Wire format API-jev se NE spremeni: endpointi
// še naprej SPREJEMAJO in VRAČAJO ta polja kot JSON STRINGE (zero-oracle
// kanon). Ta plast je edina točka, kjer se DB oblika (struct) in wire
// oblika (string) prevajata:
//   pisanje: wire string → parse/validacija → NATIVE Json value v DB
//   branje:  NATIVE Json value → toJsonWire → wire string v odgovoru
//
// Prvotni namen (P1): Prisma shema je uporabljala String za fleksibilnost +
// backward compat. Modul je dodal typed parse/serialize helpers + safe
// validators.
//
// P1-9 (v1.0.12): vsi parserji uporabljajo Zod safeParse
// (vzorec: schema.parse(JSON.parse(value)) — nikoli goli JSON.parse).
// Verzioniranje payload-ov: glej schemas.ts (JSON_FIELD_VERSION +
// migrateJsonPayload).
//
// R150 TOLERANCA: vsi parserji sprejmejo JsonFieldInput = legacy JSON string
// ALI native struct (Prisma Json). Stari stringi ostanejo berljivi tudi, če
// se kakšen stolpec (defer: AuditLog.details, WebhookDelivery.payload,
// RestaurantSettings.apiKeys, CSV allergens) še naprej drži kot String.
// ============================================

import type { ZodType } from 'zod'
import { isPermissionName } from '@/lib/auth-middleware/permission-matrix'
import {
  orderItemModifierSchema,
  printRuleSchema,
  vatBreakdownValueSchema,
  permissionSchema,
  webhookEventSchema,
  stringArraySchema,
  jsonPayloadSchema,
  type OrderItemModifier,
} from './schemas'

export {
  JSON_FIELD_VERSION,
  detectPayloadVersion,
  migrateJsonPayload,
} from './schemas'
export type {
  OrderItemModifier,
  PrintRule,
} from './schemas'

// ────────────────────────────────────────────
// TYPES — vsako JSON-as-String polje ima svoj TS type
// ────────────────────────────────────────────

/**
 * R150 (#33): rekurzivni JSON value (oblika, ki jo Prisma Json vrača iz
 * JSONB stolpcev in jo sprejema v create/update inputih).
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue | undefined }

/**
 * R150 (#33): vrednost JSON polja iz baze — legacy JSON string ALI native
 * struct (po migraciji 0022 Prisma vrača JSONB kot struct). Vsi parserji
 * sprejmejo OBE obliki (tolerantno branje).
 */
export type JsonFieldInput = JsonValue | null | undefined

/** ModifierGroup.transports */
export type ModifierTransport = 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb'

/** Job.permissions — RBAC permissions (P1-13: iz centralne matrike) */
export type Permission = import('@/lib/auth-middleware/permission-matrix').PermissionName

/** Session.permissions — isto kot Job.permissions */
export type SessionPermission = Permission

/** Webhook.events */
export type WebhookEvent =
  | 'order.created' | 'order.paid' | 'order.cancelled'
  | 'receipt.created' | 'daily.close'
  | 'stock.low'
  | 'shift.started' | 'shift.ended'

/** MenuItem.allergens — EU alergeni (1-14) */
export type Allergen = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12' | '13' | '14'

/** Supplier.deliveryDays */
export type DeliveryDay = 'pon' | 'tor' | 'sre' | 'cet' | 'pet' | 'sob' | 'ned'

/** AuditLog.details — kontekst spremembe (DEFER: ostaja String — hash veriga) */
export type AuditDetails = Record<string, unknown>

/** VatBreakdown — tolerantno: {"22": 12.34} ali {"22": {base, vat}} (glej schemas.ts) */
export type VatBreakdown = Record<string, number | { base?: number; vat?: number; baseAmount?: number; vatAmount?: number; rate?: number }>

/** Integration.config — dodatne nastavitve */
export type IntegrationConfig = Record<string, string | number | boolean>

/** ApiLog.payload + WebhookDelivery.payload */
export type JsonPayload = Record<string, unknown>

/** Guest.allergens / dietaryPrefs / dislikes / favoriteItems — string[] */
export type StringArray = string[]

// ────────────────────────────────────────────
// CORE: Zod-safe parse (P1-9 vzorec: schema.parse(JSON.parse(value)))
// R150: tolerantno tudi za native Json struct (JSONB) vhod
// ────────────────────────────────────────────

/**
 * R150 (#33): normalizacija vhodne DB vrednosti — string → JSON.parse
 * (fallback ob napaki/praznem), struct → 1:1, null/undefined → undefined
 * (klicalec uporabi fallback). Notranji helper vseh parserjev.
 */
function normalizeJsonInput(value: JsonFieldInput, fallback: unknown): unknown {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string') {
    if (value.trim() === '') return fallback
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }
  return value
}

/**
 * Zod-safe parsanje JSON polja: JSON.parse → schema.safeParse → fallback.
 * Neveljaven JSON ALI neveljavna struktura → fallback (NIKOLI throw).
 * R150: struct vhod (JSONB) gre DIREKT v Zod validacijo (brez parse-a).
 *
 * @param schema Zod shema za validacijo strukture
 * @param value JSON string ali native Json value iz baze (lahko malformed)
 * @param fallback privzeta vrednost če parse/validacija failne
 */
export function safeParseJson<T>(schema: ZodType<T>, value: JsonFieldInput, fallback: T): T {
  const normalized = normalizeJsonInput(value, undefined)
  if (normalized === undefined) return fallback
  const result = schema.safeParse(normalized)
  if (result.success) return result.data
  return fallback
}

/**
 * Varna parsanje JSON polja — vrne fallback če je neveljaven.
 * R150: struct vhod (JSONB) se vrne 1:1 (ničesar ne parsa znova).
 * (Legacy API — brez Zod; za nova polja uporabi safeParseJson.)
 */
export function safeJsonParse<T>(value: JsonFieldInput, fallback: T): T {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string') {
    if (value.trim() === '') return fallback
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return value as T
}

/**
 * Varna serializacija — vedno vrne veljaven JSON string.
 */
export function safeJsonSerialize(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return '[]'
  }
}

// ────────────────────────────────────────────
// R150 (#33): WIRE MAPPING — struct → JSON string (byte-identical kanon)
// ────────────────────────────────────────────

/**
 * Imena stolpcev, ki so po migraciji 0022 JSONB, wire format pa ostane JSON
 * string. Field-name based (ne model based): string vrednost se pusti NESTRANI
 * (legacy/CSV polja — npr. MenuItem.allergens "1,3,7" — so nedotaknjena), struct
 * (array/object) pa se re-serializira. Zato je mapper varen tudi v odgovorih,
 * ki vsebujejo mešane modele.
 */
export const JSON_WIRE_FIELDS: ReadonlySet<string> = new Set([
  'permissions',            // Job, Session
  'printRules',             // Printer
  'vatBreakdown',           // Receipt
  'emailReportRecipients',  // RestaurantSettings, Location
  'postCodes', 'cities',    // DeliveryZone
  'events',                 // Webhook, Integration
  'allergens',              // Guest (MenuItem/Modifier CSV stringi se pustijo)
  'dietaryPrefs', 'dislikes', 'favoriteItems', // Guest
  'deliveryDays',           // Supplier
  'daysOfWeek',             // MealtimeRule, HappyHourSchedule
  'appliesToIds',           // HappyHourSchedule
  'config',                 // Integration
  'requestData', 'responseData', // IntegrationLog
  'tags',                   // GuestFeedback
  'transports',             // BiometricCredential (WebAuthnCredential String se pusti)
  'itemsJson',              // KotDocument
  'scopes',                 // ApiKey
])

/**
 * R150 (#33): preslika ENO vrstico iz baze v wire obliko — vsako znano JSON
 * polje, ki je po migraciji struct, re-serializira v JSON string. String
 * vrednosti ostanejo kot so (že-wire / legacy / CSV). Nič ne doda in ne
 * odstrani polj — byte-identical wire za stare odjemalce.
 */
export function toJsonWire<T>(row: T): T {
  if (row === null || row === undefined || typeof row !== 'object' || Array.isArray(row)) {
    return row
  }
  const out: Record<string, unknown> = { ...(row as Record<string, unknown>) }
  for (const key of JSON_WIRE_FIELDS) {
    const v = out[key]
    if (v !== null && v !== undefined && typeof v !== 'string') {
      out[key] = JSON.stringify(v)
    }
  }
  return out as T
}

/** Samo plain objects (prototype Object.prototype / null) — Date, Decimal, */
/** Prisma razredi so izključeni iz globoke hoje. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

/**
 * R150 (#33): globoka wire preslika — hoja skozi array/plain object strukturo
 * (odgovori z include-i: order.orderItems, guests.visits, jobs.employees …).
 * Date/Decimal/nested razredi se pustijo nedotaknjeni.
 */
export function toJsonWireDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => toJsonWireDeep(v)) as unknown as T
  }
  if (isPlainObject(value)) {
    const out = toJsonWire({ ...value }) as unknown as Record<string, unknown>
    for (const k of Object.keys(out)) {
      out[k] = toJsonWireDeep(out[k])
    }
    return out as unknown as T
  }
  return value
}

// ────────────────────────────────────────────
// FIELD-SPECIFIC HELPERS (Zod-validirani, per-element filter)
// Elemen, ki ne prejde sheme, se izloči (en pokvarjen vnos NE uniči
// celotnega seznama — važno pri podatkih iz baze, ki jih je pisalo
// več različnih verzij kode).
// ────────────────────────────────────────────

// OrderItem.modifiersJson — [{name, price, quantity?, modifierGroupId?, id?}]
export function parseOrderItemModifiers(json: JsonFieldInput): OrderItemModifier[] {
  const arr = safeJsonParse<unknown>(json, [])
  if (!Array.isArray(arr)) return []
  return arr.flatMap((v) => {
    const r = orderItemModifierSchema.safeParse(v)
    return r.success ? [r.data] : []
  })
}

export function serializeOrderItemModifiers(modifiers: OrderItemModifier[]): string {
  return safeJsonSerialize(modifiers)
}

// Printer.printRules — [{type, prepStationId?, port?}]
export function parsePrintRules(json: JsonFieldInput): Array<{ type: string; prepStationId?: string; port?: number }> {
  const arr = safeJsonParse<unknown>(json, [])
  if (!Array.isArray(arr)) return []
  return arr.flatMap((v) => {
    const r = printRuleSchema.safeParse(v)
    return r.success ? [r.data] : []
  })
}

// daysOfWeek (MealtimeRule, HappyHourSchedule) — [1..7] (1=pon, 7=ned)
// Opomba: stare vrstice lahko vsebujejo 0-6 semantiko (getDay()) —
// tolerantno sprejmemo 0-7 in jih pustimo kot so (prikaz odloči glede na kontekst)
export function parseDaysOfWeek(json: JsonFieldInput): number[] {
  const arr = safeJsonParse<unknown>(json, [])
  if (!Array.isArray(arr)) return []
  return arr.filter((d): d is number =>
    typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 7)
}

// VatBreakdown (Receipt.vatBreakdown) — FURS fiskalni podatek; tolerantno
// per-entry: številka | {base, vat} | numerični string
export function parseVatBreakdown(json: JsonFieldInput): VatBreakdown {
  const parsed = safeJsonParse<unknown>(json, {})
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
  const result: VatBreakdown = {}
  for (const [rate, value] of Object.entries(parsed as Record<string, unknown>)) {
    const rateNum = Number(rate)
    if (!Number.isFinite(rateNum)) continue
    if (typeof value === 'number' && Number.isFinite(value)) {
      result[rate] = value
    } else if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
      result[rate] = Number(value) // stara koda je konvertirala numerične stringe
    } else if (value && typeof value === 'object') {
      // Receipt format: {"22": {base: 10, vat: 2.2}} — validiraj strukturo
      const r = vatBreakdownValueSchema.safeParse(value)
      if (r.success) result[rate] = r.data
    }
    // boolean/null/NaN vrednosti se izločijo (per-entry filter)
  }
  return result
}

// Job.permissions / Session.permissions — RBAC (filtrira neveljavne vnose)
export function parsePermissions(json: JsonFieldInput): Permission[] {
  const arr = safeJsonParse<unknown>(json, [])
  if (!Array.isArray(arr)) return []
  return arr.flatMap((v) => {
    const r = permissionSchema.safeParse(v)
    return r.success ? [r.data] : []
  })
}

export function serializePermissions(permissions: Permission[]): string {
  return safeJsonSerialize([...new Set(permissions)]) // dedup
}

// Webhook.events
export function parseWebhookEvents(json: JsonFieldInput): WebhookEvent[] {
  const arr = safeJsonParse<unknown>(json, [])
  if (!Array.isArray(arr)) return []
  return arr.flatMap((v) => {
    const r = webhookEventSchema.safeParse(v)
    return r.success ? [r.data] : []
  })
}

// MenuItem.allergens — EU alergeni (1-14)
// P1-9 FIX: baza vsebuje DVA formata — JSON '["1","3"]' (Guest; po 0022 struct)
// in CSV "1,3" (MenuItem/Modifier, OSTAJA String — izven scope-a #33).
// Toleranten parser podpira VSE; CSV se normalizira ob branju (migracija
// "on read" — zapis ostaja nespremenjen).
export function parseAllergens(value: JsonFieldInput): Allergen[] {
  const validAllergens = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14']
  if (value === null || value === undefined) return []

  // 1) ŽE struct (Guest.allergens po 0022: JSONB array) — per-element filter
  if (Array.isArray(value)) {
    return value
      .map((a) => String(a))
      .filter((a) => validAllergens.includes(a)) as Allergen[]
  }

  if (typeof value === 'string') {
    if (value.trim() === '') return []

    // 2) JSON array string (kanonični format) — per-element filter
    //    (neveljaven element izloči, ne uniči celoten seznam)
    const parsed = safeJsonParse<unknown>(value, null)
    if (Array.isArray(parsed)) {
      return parsed
        .map((a) => String(a))
        .filter((a) => validAllergens.includes(a)) as Allergen[]
    }

    // 3) CSV fallback: "1,3,7" (MenuItem legacy format) — nikoli throw!
    if (typeof parsed !== 'object' || parsed === null) {
      return value
        .split(',')
        .map((a) => a.trim())
        .filter((a) => validAllergens.includes(a)) as Allergen[]
    }
  }
  return []
}

// Supplier.deliveryDays
export function parseDeliveryDays(json: JsonFieldInput): DeliveryDay[] {
  const valid: DeliveryDay[] = ['pon', 'tor', 'sre', 'cet', 'pet', 'sob', 'ned']
  const parsed = safeParseJson(stringArraySchema, json, [])
  return parsed.filter((d): d is DeliveryDay => valid.includes(d as DeliveryDay))
}

// AuditLog.details / ApiLog.payload / WebhookDelivery.payload (DEFER — String)
export function parseJsonPayload(json: JsonFieldInput): JsonPayload {
  return safeParseJson(jsonPayloadSchema, json, {})
}

// Generic String[] (Guest.favoriteItems, Guest.dislikes, itd.)
export function parseStringArray(json: JsonFieldInput): StringArray {
  const arr = safeJsonParse<unknown>(json, [])
  if (!Array.isArray(arr)) return []
  return arr.filter((e): e is string => typeof e === 'string')
}

// Integration.config
export function parseIntegrationConfig(json: JsonFieldInput): IntegrationConfig {
  return safeParseJson(jsonPayloadSchema, json, {}) as IntegrationConfig
}

// ────────────────────────────────────────────
// VALIDATORS (type-guards)
// ────────────────────────────────────────────

export function isOrderItemModifier(value: unknown): value is OrderItemModifier {
  return orderItemModifierSchema.safeParse(value).success
}

export function isPermission(value: string): value is Permission {
  return isPermissionName(value)
}

// ────────────────────────────────────────────
// MIGRACIJSKI DASHBOARD
// ────────────────────────────────────────────

export interface JsonFieldDescriptor {
  model: string
  field: string
  type: 'array' | 'object'
  description: string
  parser: string // function name
  /** R150 (#33): true = po migraciji 0022 JSONB (Prisma Json) */
  migrated?: boolean
}

/**
 * Inventar vseh JSON polj v shemi (R150 #33 posodobljen — registry drift fix:
 * 6 zastarelih vnosov odstranjenih/prehierarhijenih na REALNO shemo:
 *   Order.vatBreakdown (ne obstaja) → odstranjeno
 *   OpeningHours.daysOfWeek (Int dan, ni JSON) → odstranjeno
 *   HappyHour → HappyHourSchedule (preimenovan model)
 *   Discount.appliesToIds (ne obstaja; polje je na HappyHourSchedule) → preneseno
 *   ApiLog.requestData/responseData (model zdaj IntegrationLog) → preneseno
 *   ScheduledEmailLog.itemsJson (polje je na KotDocument) → preneseno
 * DEFER (String, byte-exact pin): AuditLog.details, WebhookDelivery.payload,
 * RestaurantSettings.apiKeys. CSV (ni JSON): MenuItem.allergens, Modifier.allergens.
 */
export const JSON_FIELDS: JsonFieldDescriptor[] = [
  // — MIGRIRANO (R150, 0022_json_fields → Prisma Json/JSONB) —
  { model: 'OrderItem', field: 'modifiersJson', type: 'array', description: 'Modifierji izbrane pri naročilu [{name, price}] — LEGACY wire (dual-write z OrderItemModifier)', parser: 'parseOrderItemModifiers' },
  { model: 'Printer', field: 'printRules', type: 'array', description: 'Pravila za tiskanje', parser: 'parsePrintRules', migrated: true },
  { model: 'Job', field: 'permissions', type: 'array', description: 'RBAC dovoljenja', parser: 'parsePermissions', migrated: true },
  { model: 'Session', field: 'permissions', type: 'array', description: 'RBAC dovoljenja (session copy)', parser: 'parsePermissions', migrated: true },
  { model: 'Receipt', field: 'vatBreakdown', type: 'object', description: 'DDV razčlenitev (FURS)', parser: 'parseVatBreakdown', migrated: true },
  { model: 'RestaurantSettings', field: 'emailReportRecipients', type: 'array', description: 'Email prejemniki poročil', parser: 'parseStringArray', migrated: true },
  { model: 'Location', field: 'emailReportRecipients', type: 'array', description: 'Email prejemniki poročil (per lokacija)', parser: 'parseStringArray', migrated: true },
  { model: 'DeliveryZone', field: 'postCodes', type: 'array', description: 'Poštne številke v coni', parser: 'parseStringArray', migrated: true },
  { model: 'DeliveryZone', field: 'cities', type: 'array', description: 'Mesta v coni', parser: 'parseStringArray', migrated: true },
  { model: 'Webhook', field: 'events', type: 'array', description: 'Event type-i za webhook', parser: 'parseWebhookEvents', migrated: true },
  { model: 'Guest', field: 'allergens', type: 'array', description: 'Alergeni gosta', parser: 'parseAllergens', migrated: true },
  { model: 'Guest', field: 'dietaryPrefs', type: 'array', description: 'Dietne preference', parser: 'parseStringArray', migrated: true },
  { model: 'Guest', field: 'dislikes', type: 'array', description: 'Kaj gost ne mara', parser: 'parseStringArray', migrated: true },
  { model: 'Guest', field: 'favoriteItems', type: 'array', description: 'Najljubše jedi', parser: 'parseStringArray', migrated: true },
  { model: 'Supplier', field: 'deliveryDays', type: 'array', description: 'Dnevi dostave', parser: 'parseDeliveryDays', migrated: true },
  { model: 'MealtimeRule', field: 'daysOfWeek', type: 'array', description: 'Dnevi tedna [1-7] (jedilni časi)', parser: 'parseDaysOfWeek', migrated: true },
  { model: 'HappyHourSchedule', field: 'daysOfWeek', type: 'array', description: 'Dnevi tedna [1-7]', parser: 'parseDaysOfWeek', migrated: true },
  { model: 'HappyHourSchedule', field: 'appliesToIds', type: 'array', description: 'ID-ji na katere se nanaša', parser: 'parseStringArray', migrated: true },
  { model: 'Integration', field: 'config', type: 'object', description: 'Dodatne nastavitve', parser: 'parseIntegrationConfig', migrated: true },
  { model: 'Integration', field: 'events', type: 'array', description: 'Event-i za sinhronizacijo', parser: 'parseStringArray', migrated: true },
  { model: 'IntegrationLog', field: 'requestData', type: 'object', description: 'Poslani podatki', parser: 'parseJsonPayload', migrated: true },
  { model: 'IntegrationLog', field: 'responseData', type: 'object', description: 'Prejeti odziv', parser: 'parseJsonPayload', migrated: true },
  { model: 'GuestFeedback', field: 'tags', type: 'array', description: 'Tagi povratne informacije', parser: 'parseStringArray', migrated: true },
  { model: 'BiometricCredential', field: 'transports', type: 'array', description: 'FIDO2 transports', parser: 'parseStringArray', migrated: true },
  { model: 'KotDocument', field: 'itemsJson', type: 'array', description: 'Items v kuhinjskem listu', parser: 'parseStringArray', migrated: true },
  { model: 'ApiKey', field: 'scopes', type: 'array', description: 'Dovoljenja API ključa', parser: 'parseStringArray', migrated: true },
  // — DEFER (String, byte-exact pin — kontrakt R150-a) —
  { model: 'AuditLog', field: 'details', type: 'object', description: 'Kontekst spremembe — DEFER String (hash veriga recompute-a iz shranjenega stringa)', parser: 'parseJsonPayload' },
  { model: 'WebhookDelivery', field: 'payload', type: 'object', description: 'JSON payload poslan — DEFER String (retry + HMAC reproducibilnost)', parser: 'parseJsonPayload' },
  { model: 'RestaurantSettings', field: 'apiKeys', type: 'array', description: 'API ključi za cron/integrations — DEFER String (deprecatiran keystore)', parser: 'parseStringArray' },
  // — CSV (NISTA JSON — izven scope-a #33) —
  { model: 'MenuItem', field: 'allergens', type: 'array', description: 'EU alergeni (1-14) — CSV ali JSON', parser: 'parseAllergens' },
  { model: 'Modifier', field: 'allergens', type: 'array', description: 'EU alergeni (1-14) — CSV ali JSON', parser: 'parseAllergens' },
]

export interface JsonFieldStats {
  totalFields: number
  arrayFields: number
  objectFields: number
  modelsAffected: number
  hasHelpers: boolean
  usesPrismaJson: boolean
  zodValidated: boolean
  recommendations: string[]
}

export function getJsonFieldStats(): JsonFieldStats {
  const arrayCount = JSON_FIELDS.filter((f) => f.type === 'array').length
  const objectCount = JSON_FIELDS.filter((f) => f.type === 'object').length
  const models = new Set(JSON_FIELDS.map((f) => f.model))
  const migratedCount = JSON_FIELDS.filter((f) => f.migrated).length

  return {
    totalFields: JSON_FIELDS.length,
    arrayFields: arrayCount,
    objectFields: objectCount,
    modelsAffected: models.size,
    hasHelpers: true,
    usesPrismaJson: true, // R150 (#33): Phase 3 KONČAN — migracija 0022_json_fields
    zodValidated: true, // P1-9: safeParseJson (Zod) vzorec
    recommendations: [
      `✅ ${JSON_FIELDS.length} JSON polj inventariziranih (${arrayCount} array, ${objectCount} object).`,
      `✅ ${models.size} modelov ima JSON polja.`,
      `✅ P1-9: Zod safeParse validacija (schema.parse(JSON.parse(value)) vzorec).`,
      `✅ P1-9: verzioniranje payload-ov (JSON_FIELD_VERSION + migrateJsonPayload).`,
      `✅ P1-9: allergens tolerantni parser (CSV "1,3" + JSON '["1","3"]').`,
      `✅ R150 (#33): Phase 3 KONČAN — ${migratedCount} polj migriranih na Prisma Json (0022_json_fields); wire format ostaja JSON string (toJsonWire).`,
    ],
  }
}
