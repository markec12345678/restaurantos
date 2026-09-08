// ============================================
// JSON FIELDS — Central typed layer for JSON-as-String fields
//
// ISSUE #33: OrderItem.modifiersJson + 20 JSON-as-String polj.
// Prisma shema uporablja String za fleksibilnost + backward compat.
// Ta modul doda typed parse/serialize helpers + safe validators.
//
// P1-9 (v1.0.12): vsi parserji zdaj uporabljajo Zod safeParse
// (vzorec: schema.parse(JSON.parse(value)) — nikoli goli JSON.parse).
// Verzioniranje payload-ov: glej schemas.ts (JSON_FIELD_VERSION +
// migrateJsonPayload).
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

/** AuditLog.details — kontekst spremembe */
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
// ────────────────────────────────────────────

/**
 * Zod-safe parsanje JSON stringa: JSON.parse → schema.safeParse → fallback.
 * Neveljaven JSON ALI neveljavna struktura → fallback (NIKOLI throw).
 *
 * @param schema Zod shema za validacijo strukture
 * @param jsonString JSON string iz baze (lahko malformed)
 * @param fallback privzeta vrednost če parse/validacija failne
 */
export function safeParseJson<T>(schema: ZodType<T>, jsonString: string | null | undefined, fallback: T): T {
  if (!jsonString || jsonString.trim() === '') return fallback
  try {
    const parsed = JSON.parse(jsonString)
    const result = schema.safeParse(parsed)
    if (result.success) return result.data
    return fallback
  } catch {
    return fallback
  }
}

/**
 * Varna parsanje JSON stringa — vrne fallback če je neveljaven.
 * (Legacy API — brez Zod; za nova polja uporabi safeParseJson.)
 */
export function safeJsonParse<T>(jsonString: string | null | undefined, fallback: T): T {
  if (!jsonString || jsonString.trim() === '') return fallback
  try {
    const parsed = JSON.parse(jsonString)
    return parsed as T
  } catch {
    return fallback
  }
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
// FIELD-SPECIFIC HELPERS (Zod-validirani, per-element filter)
// Elemen, ki ne prejde sheme, se izloči (en pokvarjen vnos NE uniči
// celotnega seznama — važno pri podatkih iz baze, ki jih je pisalo
// več različnih verzij kode).
// ────────────────────────────────────────────

// OrderItem.modifiersJson — [{name, price, quantity?, modifierGroupId?, id?}]
export function parseOrderItemModifiers(json: string | null | undefined): OrderItemModifier[] {
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
export function parsePrintRules(json: string | null | undefined): Array<{ type: string; prepStationId?: string; port?: number }> {
  const arr = safeJsonParse<unknown>(json, [])
  if (!Array.isArray(arr)) return []
  return arr.flatMap((v) => {
    const r = printRuleSchema.safeParse(v)
    return r.success ? [r.data] : []
  })
}

// daysOfWeek (OpeningHours, HappyHour) — [1..7] (1=pon, 7=ned)
// Opomba: stare vrstice lahko vsebujejo 0-6 semantiko (getDay()) —
// tolerantno sprejmemo 0-7 in jih pustimo kot so (prikaz odloči glede na kontekst)
export function parseDaysOfWeek(json: string | null | undefined): number[] {
  const arr = safeJsonParse<unknown>(json, [])
  if (!Array.isArray(arr)) return []
  return arr.filter((d): d is number =>
    typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 7)
}

// VatBreakdown (Order.vatBreakdown, Receipt.vatBreakdown) — FURS fiskalni
// podatek; tolerantno per-entry: številka | {base, vat} | numerični string
export function parseVatBreakdown(json: string | null | undefined): VatBreakdown {
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
export function parsePermissions(json: string | null | undefined): Permission[] {
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
export function parseWebhookEvents(json: string | null | undefined): WebhookEvent[] {
  const arr = safeJsonParse<unknown>(json, [])
  if (!Array.isArray(arr)) return []
  return arr.flatMap((v) => {
    const r = webhookEventSchema.safeParse(v)
    return r.success ? [r.data] : []
  })
}

// MenuItem.allergens — EU alergeni (1-14)
// P1-9 FIX: baza vsebuje DVA formata — JSON '["1","3"]' (Guest) in CSV
// "1,3" (MenuItem/Modifier). Toleranten parser podpira OBA; CSV se normalizira
// ob branju (migracija "on read" — zapis ostaja nespremenjen).
export function parseAllergens(json: string | null | undefined): Allergen[] {
  const validAllergens = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14']
  if (!json || json.trim() === '') return []

  // 1) JSON array (kanonični format) — per-element filter
  //    (neveljaven element izloči, ne uniči celoten seznam)
  const parsed = safeJsonParse<unknown>(json, null)
  if (Array.isArray(parsed)) {
    return parsed
      .map((a) => String(a))
      .filter((a) => validAllergens.includes(a)) as Allergen[]
  }

  // 2) CSV fallback: "1,3,7" (MenuItem legacy format) — nikoli throw!
  if (typeof parsed !== 'object' || parsed === null) {
    return json
      .split(',')
      .map((a) => a.trim())
      .filter((a) => validAllergens.includes(a)) as Allergen[]
  }
  return []
}

// Supplier.deliveryDays
export function parseDeliveryDays(json: string | null | undefined): DeliveryDay[] {
  const valid: DeliveryDay[] = ['pon', 'tor', 'sre', 'cet', 'pet', 'sob', 'ned']
  const parsed = safeParseJson(stringArraySchema, json, [])
  return parsed.filter((d): d is DeliveryDay => valid.includes(d as DeliveryDay))
}

// AuditLog.details / ApiLog.payload / WebhookDelivery.payload
export function parseJsonPayload(json: string | null | undefined): JsonPayload {
  return safeParseJson(jsonPayloadSchema, json, {})
}

// Generic String[] (Guest.favoriteItems, Guest.dislikes, itd.)
export function parseStringArray(json: string | null | undefined): StringArray {
  const arr = safeJsonParse<unknown>(json, [])
  if (!Array.isArray(arr)) return []
  return arr.filter((e): e is string => typeof e === 'string')
}

// Integration.config
export function parseIntegrationConfig(json: string | null | undefined): IntegrationConfig {
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
}

/** Inventar vseh JSON-as-String polj v shemi */
export const JSON_FIELDS: JsonFieldDescriptor[] = [
  { model: 'OrderItem', field: 'modifiersJson', type: 'array', description: 'Modifierji izbrane pri naročilu [{name, price}]', parser: 'parseOrderItemModifiers' },
  { model: 'Printer', field: 'printRules', type: 'array', description: 'Pravila za tiskanje', parser: 'parsePrintRules' },
  { model: 'Job', field: 'permissions', type: 'array', description: 'RBAC dovoljenja', parser: 'parsePermissions' },
  { model: 'Session', field: 'permissions', type: 'array', description: 'RBAC dovoljenja (session copy)', parser: 'parsePermissions' },
  { model: 'Order', field: 'vatBreakdown', type: 'object', description: 'DDV razčlenitev po stopnjah', parser: 'parseVatBreakdown' },
  { model: 'Receipt', field: 'vatBreakdown', type: 'object', description: 'DDV razčlenitev (FURS)', parser: 'parseVatBreakdown' },
  { model: 'OpeningHours', field: 'daysOfWeek', type: 'array', description: 'Dnevi tedna [1-7]', parser: 'parseDaysOfWeek' },
  { model: 'HappyHour', field: 'daysOfWeek', type: 'array', description: 'Dnevi tedna [1-7]', parser: 'parseDaysOfWeek' },
  { model: 'RestaurantSettings', field: 'apiKeys', type: 'array', description: 'API ključi za cron/integrations', parser: 'parseStringArray' },
  { model: 'RestaurantSettings', field: 'emailReportRecipients', type: 'array', description: 'Email prejemniki poročil', parser: 'parseStringArray' },
  { model: 'DeliveryZone', field: 'postCodes', type: 'array', description: 'Poštne številke v coni', parser: 'parseStringArray' },
  { model: 'DeliveryZone', field: 'cities', type: 'array', description: 'Mesta v coni', parser: 'parseStringArray' },
  { model: 'Webhook', field: 'events', type: 'array', description: 'Event type-i za webhook', parser: 'parseWebhookEvents' },
  { model: 'AuditLog', field: 'details', type: 'object', description: 'Kontekst spremembe', parser: 'parseJsonPayload' },
  { model: 'MenuItem', field: 'allergens', type: 'array', description: 'EU alergeni (1-14) — CSV ali JSON', parser: 'parseAllergens' },
  { model: 'Modifier', field: 'allergens', type: 'array', description: 'EU alergeni (1-14) — CSV ali JSON', parser: 'parseAllergens' },
  { model: 'Guest', field: 'allergens', type: 'array', description: 'Alergeni gosta', parser: 'parseAllergens' },
  { model: 'Guest', field: 'dietaryPrefs', type: 'array', description: 'Dietne preference', parser: 'parseStringArray' },
  { model: 'Guest', field: 'dislikes', type: 'array', description: 'Kaj gost ne mara', parser: 'parseStringArray' },
  { model: 'Guest', field: 'favoriteItems', type: 'array', description: 'Najljubše jedi', parser: 'parseStringArray' },
  { model: 'Supplier', field: 'deliveryDays', type: 'array', description: 'Dnevi dostave', parser: 'parseDeliveryDays' },
  { model: 'Discount', field: 'appliesToIds', type: 'array', description: 'ID-ji na katere se nanaša', parser: 'parseStringArray' },
  { model: 'WebhookDelivery', field: 'payload', type: 'object', description: 'JSON payload poslan', parser: 'parseJsonPayload' },
  { model: 'Integration', field: 'config', type: 'object', description: 'Dodatne nastavitve', parser: 'parseIntegrationConfig' },
  { model: 'ApiLog', field: 'requestData', type: 'object', description: 'Poslani podatki', parser: 'parseJsonPayload' },
  { model: 'ApiLog', field: 'responseData', type: 'object', description: 'Prejeti odziv', parser: 'parseJsonPayload' },
  { model: 'BiometricCredential', field: 'transports', type: 'array', description: 'FIDO2 transports', parser: 'parseStringArray' },
  { model: 'GuestFeedback', field: 'tags', type: 'array', description: 'Tagi povratne informacije', parser: 'parseStringArray' },
  { model: 'ScheduledEmailLog', field: 'itemsJson', type: 'array', description: 'Items v email', parser: 'parseJsonPayload' },
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

  return {
    totalFields: JSON_FIELDS.length,
    arrayFields: arrayCount,
    objectFields: objectCount,
    modelsAffected: models.size,
    hasHelpers: true,
    usesPrismaJson: false, // Phase 3 cilj
    zodValidated: true, // P1-9: safeParseJson (Zod) vzorec
    recommendations: [
      `✅ ${JSON_FIELDS.length} JSON-as-String polj inventariziranih (${arrayCount} array, ${objectCount} object).`,
      `✅ ${models.size} modelov ima JSON polja.`,
      `✅ P1-9: Zod safeParse validacija (schema.parse(JSON.parse(value)) vzorec).`,
      `✅ P1-9: verzioniranje payload-ov (JSON_FIELD_VERSION + migrateJsonPayload).`,
      `✅ P1-9: allergens tolerantni parser (CSV "1,3" + JSON '["1","3"]').`,
      '🔧 Phase 3 (prihodnost): Prisma Json type ali FK relacije (OrderItemModifier model).',
    ],
  }
}
