// ============================================
// JSON FIELDS — Zod sheme (P1-9)
// ============================================
// Uporabnikov vzorec: `schema.parse(JSON.parse(value))` — nikoli goli
// JSON.parse nad bazo. Vsako polje ima:
//   1. Zod shemo (validacija obliki + vrednostim)
//   2. Safe parser (neveljaven JSON/type → fallback, NIKOLI throw)
//   3. Verzioniranje: parser podpira {"version": N, ...} envelope — ko se
//      format nekega dne spremeni, serializacija zapiše version: 2 in
//      migrate funkcija pretvori stare zapise. Trenutni format = V1
//      (brez envelope-a — backward kompatibilno z vsemi obstoječimi
//      vrsticami v bazi).
// ============================================

import { z } from 'zod'

// ────────────────────────────────────────────
// VERZIONIRANJE (P1-9: "version every JSON payload")
// ────────────────────────────────────────────

/** Trenutna verzija formata JSON polj (V1 = historični format brez envelope-a) */
export const JSON_FIELD_VERSION = 1

/**
 * Razširi envelope: `{"version": N, ...}` → prepozna verzijo.
 * Brez envelope-a (historijski zapisi) → verzija 1.
 */
export function detectPayloadVersion(parsed: unknown): number {
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const v = (parsed as Record<string, unknown>).version
    if (typeof v === 'number' && Number.isInteger(v) && v > 0) return v
  }
  return JSON_FIELD_VERSION
}

/**
 * Vzorec migracije JSON payload-a (P1-9: "add migration function on schema
 * change"). Ko format preide na V2, dodaš case 2 → 1 pretvorbo in serializacija
 * začne pisati version: 2. Parserji VEDNO vračajo kanonično V1 obliko.
 */
export function migrateJsonPayload<T>(parsed: unknown, migrations: Record<number, (_raw: unknown) => T>): T {
  const version = detectPayloadVersion(parsed)
  const migrate = migrations[version]
  if (migrate) return migrate(parsed)
  // Neznana PRIHODNJA verzija: ne pademo — fallback v default (fail-safe,
  // ker vsak parser že vrača fallback ven iz te funkcije ob napaki).
  throw new Error(`Neznana verzija JSON payload-a: ${version}`)
}

// ────────────────────────────────────────────
// OrderItem.modifiersJson — najbolj kritično polje
// (bere se: POS prikaz, KDS, tisk, izračun računa, course pacing)
// ────────────────────────────────────────────

export const orderItemModifierSchema = z.object({
  id: z.string().optional(), // modifier ID — uporablja se za DB price lookup (server-side re-cena)
  name: z.string(),
  price: z.number(),
  quantity: z.number().optional(),
  modifierGroupId: z.string().optional(),
})

export const orderItemModifiersSchema = z.array(orderItemModifierSchema)

export type OrderItemModifier = z.infer<typeof orderItemModifierSchema>

// ────────────────────────────────────────────
// Printer.printRules — routing tiskalnikov
// ────────────────────────────────────────────

export const printRuleSchema = z.object({
  type: z.string(),
  prepStationId: z.string().optional(),
  port: z.number().optional(),
})

export const printRulesSchema = z.array(printRuleSchema)

export type PrintRule = z.infer<typeof printRuleSchema>

// ────────────────────────────────────────────
// daysOfWeek (OpeningHours, HappyHour) — 1=pon … 7=ned
// ────────────────────────────────────────────

export const daysOfWeekSchema = z.array(z.number().int().min(1).max(7)).min(1)

// ────────────────────────────────────────────
// allergens — EU alergeni 1–14
// DVA zgodovinska formata v bazi (P1-9 bug):
//   - MenuItem/Modifier: CSV "1,3,7" (default "")
//   - Guest: JSON '["1","3"]' (default "[]")
// Toleranten parser podpira OBA (CSV fallback = migracija ob branju).
// ────────────────────────────────────────────

export const allergenSchema = z.string().regex(/^([1-9]|1[0-4])$/, 'EU alergen 1–14')

export const allergensSchema = z.array(allergenSchema)

// ────────────────────────────────────────────
// Receipt/Order.vatBreakdown — FURS fiskalni podatki
// DVA zgodovinska zapisa:
//   - Receipt: {"22": {"base": 10.0, "vat": 2.2}} (Object.entries format)
//   - Order / outbox: {"22": 2.2} ali Array<{rate, baseAmount, vatAmount}>
// Union shema sprejme vse tri (tolerantno — usklajevanje formatov je
// ločena naloga; parser NE sme izgubiti veljavnih podatkov).
// ────────────────────────────────────────────

export const vatBreakdownValueSchema = z.union([
  z.number(),
  z.object({
    base: z.number().optional(),
    vat: z.number().optional(),
    baseAmount: z.number().optional(),
    vatAmount: z.number().optional(),
    rate: z.number().optional(),
  }),
])

export const vatBreakdownSchema = z.record(z.string(), vatBreakdownValueSchema)

// ────────────────────────────────────────────
// Job/Session.permissions — RBAC (varnostno relevantno)
// ────────────────────────────────────────────

export const permissionSchema = z.enum([
  'admin', 'manage_employees', 'manage_cash', 'manage_inventory',
  'take_orders', 'void_items', 'apply_discounts', 'view_reports',
])

export const permissionsSchema = z.array(permissionSchema)

// ────────────────────────────────────────────
// Webhook.events
// ────────────────────────────────────────────

export const webhookEventSchema = z.enum([
  'order.created', 'order.paid', 'order.cancelled',
  'receipt.created', 'daily.close',
  'stock.low',
  'shift.started', 'shift.ended',
])

export const webhookEventsSchema = z.array(webhookEventSchema)

// ────────────────────────────────────────────
// Splošni
// ────────────────────────────────────────────

export const stringArraySchema = z.array(z.string())

export const jsonPayloadSchema = z.record(z.string(), z.unknown())
