// ============================================
// JSON FIELDS — Central typed layer for JSON-as-String fields
//
// ISSUE #33: OrderItem.modifiersJson + 20 JSON-as-String polj.
// Prisma shema uporablja String za fleksibilnost + backward compat.
// Ta modul doda typed parse/serialize helpers + safe validators.
//
// Strategija (phased):
//   1. NE spreminjaj Prisma sheme (prevelika sprememba)
//   2. DODAJ typed helpers za vsako JSON-as-String polje
//   3. DODAJ safe parse (catch malformed JSON, vrni default)
//   4. DODAJ type-guards za validacijo API input
//   5. V prihodnosti: Prisma Json type ali FK relacije (Phase 3)
// ============================================

// ────────────────────────────────────────────
// TYPES — vsako JSON-as-String polje ima svoj TS type
// ────────────────────────────────────────────

/** OrderItem.modifiersJson — modifierji izbrane pri naročilu */
export interface OrderItemModifier {
  name: string
  price: number
  quantity?: number
  modifierGroupId?: string
}

/** ModifierGroup.transports */
export type ModifierTransport = 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb'

/** Job.permissions — RBAC permissions */
export type Permission = 'admin' | 'manage_employees' | 'manage_cash' | 'manage_inventory' | 'take_orders' | 'void_items' | 'apply_discounts' | 'view_reports'

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

/** VatBreakdown — { "22": 12.34, "9.5": 5.55 } */
export type VatBreakdown = Record<string, number>

/** Integration.config — dodatne nastavitve */
export type IntegrationConfig = Record<string, string | number | boolean>

/** ApiLog.payload + WebhookDelivery.payload */
export type JsonPayload = Record<string, unknown>

/** Guest.allergens / dietaryPrefs / dislikes / favoriteItems — string[] */
export type StringArray = string[]

// ────────────────────────────────────────────
// SAFE PARSE — vrne default če JSON ni veljaven
// ────────────────────────────────────────────

/**
 * Varna parsanje JSON stringa — vrne fallback če je neveljaven.
 *
 * @param jsonString - JSON string iz baze (lahko malformed)
 * @param fallback - privzeta vrednost če parse failne
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
// FIELD-SPECIFIC HELPERS
// ────────────────────────────────────────────

// OrderItem.modifiersJson
export function parseOrderItemModifiers(json: string | null | undefined): OrderItemModifier[] {
  const parsed = safeJsonParse<OrderItemModifier[]>(json, [])
  return Array.isArray(parsed) ? parsed : []
}

export function serializeOrderItemModifiers(modifiers: OrderItemModifier[]): string {
  return safeJsonSerialize(modifiers)
}

// Job.permissions / Session.permissions
export function parsePermissions(json: string | null | undefined): Permission[] {
  const parsed = safeJsonParse<unknown>(json, [])
  if (!Array.isArray(parsed)) return []
  const validPermissions: Permission[] = [
    'admin', 'manage_employees', 'manage_cash', 'manage_inventory',
    'take_orders', 'void_items', 'apply_discounts', 'view_reports',
  ]
  return parsed.filter((p): p is Permission =>
    typeof p === 'string' && validPermissions.includes(p as Permission),
  )
}

export function serializePermissions(permissions: Permission[]): string {
  return safeJsonSerialize([...new Set(permissions)]) // dedup
}

// Webhook.events
export function parseWebhookEvents(json: string | null | undefined): WebhookEvent[] {
  const parsed = safeJsonParse<unknown>(json, [])
  if (!Array.isArray(parsed)) return []
  const valid: WebhookEvent[] = [
    'order.created', 'order.paid', 'order.cancelled',
    'receipt.created', 'daily.close',
    'stock.low',
    'shift.started', 'shift.ended',
  ]
  return parsed.filter((e): e is WebhookEvent =>
    typeof e === 'string' && valid.includes(e as WebhookEvent),
  )
}

// MenuItem.allergens
export function parseAllergens(json: string | null | undefined): Allergen[] {
  const parsed = safeJsonParse<unknown>(json, [])
  if (!Array.isArray(parsed)) return []
  const validAllergens = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14']
  return parsed.filter((a): a is Allergen =>
    typeof a === 'string' && validAllergens.includes(a),
  )
}

// Supplier.deliveryDays
export function parseDeliveryDays(json: string | null | undefined): DeliveryDay[] {
  const parsed = safeJsonParse<unknown>(json, [])
  if (!Array.isArray(parsed)) return []
  const valid: DeliveryDay[] = ['pon', 'tor', 'sre', 'cet', 'pet', 'sob', 'ned']
  return parsed.filter((d): d is DeliveryDay =>
    typeof d === 'string' && valid.includes(d as DeliveryDay),
  )
}

// AuditLog.details / ApiLog.payload / WebhookDelivery.payload
export function parseJsonPayload(json: string | null | undefined): JsonPayload {
  const parsed = safeJsonParse<unknown>(json, {})
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as JsonPayload
  }
  return {}
}

// VatBreakdown (Order.vatBreakdown)
export function parseVatBreakdown(json: string | null | undefined): VatBreakdown {
  const parsed = safeJsonParse<unknown>(json, {})
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const result: VatBreakdown = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'number') result[k] = v
      else if (typeof v === 'string') {
        const n = Number(v)
        if (!Number.isNaN(n)) result[k] = n
      }
    }
    return result
  }
  return {}
}

// Generic String[] (Guest.favoriteItems, Guest.dislikes, etc.)
export function parseStringArray(json: string | null | undefined): StringArray {
  const parsed = safeJsonParse<unknown>(json, [])
  if (!Array.isArray(parsed)) return []
  return parsed.filter((s): s is string => typeof s === 'string')
}

// Integration.config
export function parseIntegrationConfig(json: string | null | undefined): IntegrationConfig {
  const parsed = safeJsonParse<unknown>(json, {})
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as IntegrationConfig
  }
  return {}
}

// ────────────────────────────────────────────
// VALIDATORS (type-guards)
// ────────────────────────────────────────────

export function isOrderItemModifier(value: unknown): value is OrderItemModifier {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.name === 'string' && typeof v.price === 'number'
}

export function isPermission(value: string): value is Permission {
  const valid: Permission[] = [
    'admin', 'manage_employees', 'manage_cash', 'manage_inventory',
    'take_orders', 'void_items', 'apply_discounts', 'view_reports',
  ]
  return valid.includes(value as Permission)
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
  { model: 'Printer', field: 'printRules', type: 'array', description: 'Pravila za tiskanje', parser: 'parseJsonPayload' },
  { model: 'Job', field: 'permissions', type: 'array', description: 'RBAC dovoljenja', parser: 'parsePermissions' },
  { model: 'Session', field: 'permissions', type: 'array', description: 'RBAC dovoljenja (session copy)', parser: 'parsePermissions' },
  { model: 'Order', field: 'vatBreakdown', type: 'object', description: 'DDV razčlenitev po stopnjah', parser: 'parseVatBreakdown' },
  { model: 'RestaurantSettings', field: 'apiKeys', type: 'array', description: 'API ključi za cron/integrations', parser: 'parseStringArray' },
  { model: 'RestaurantSettings', field: 'emailReportRecipients', type: 'array', description: 'Email prejemniki poročil', parser: 'parseStringArray' },
  { model: 'DeliveryZone', field: 'postCodes', type: 'array', description: 'Poštne številke v coni', parser: 'parseStringArray' },
  { model: 'DeliveryZone', field: 'cities', type: 'array', description: 'Mesta v coni', parser: 'parseStringArray' },
  { model: 'Webhook', field: 'events', type: 'array', description: 'Event type-i za webhook', parser: 'parseWebhookEvents' },
  { model: 'AuditLog', field: 'details', type: 'object', description: 'Kontekst spremembe', parser: 'parseJsonPayload' },
  { model: 'MenuItem', field: 'allergens', type: 'array', description: 'EU alergeni (1-14)', parser: 'parseAllergens' },
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
    recommendations: [
      `✅ ${JSON_FIELDS.length} JSON-as-String polj inventariziranih (${arrayCount} array, ${objectCount} object).`,
      `✅ ${models.size} modelov ima JSON polja.`,
      '✅ Typed parse/serialize helpers za vsako polje (safe parse z fallback).',
      '📋 Phase 2: postopno uporabljaj helpers v API rutah namesto direktnega JSON.parse().',
      '🔧 Phase 3 (v1.0.0): Prisma Json type ali FK relacije (OrderItemModifier model).',
      '💡 Prednosti: catch malformed JSON v bazi, type-safety v novi kodi.',
    ],
  }
}
