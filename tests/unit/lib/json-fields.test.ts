// ============================================
// JSON FIELDS — Unit testi (Issue #33)
//
// Preverjamo:
// - safeJsonParse: vrne fallback za malformed JSON
// - safeJsonSerialize: vedno veljaven JSON string
// - parseOrderItemModifiers: typed parsing
// - parsePermissions: filtra neveljavnih permissions
// - parseWebhookEvents: filtra neznane event-e
// - parseAllergens: veljavni 1-14
// - parseDeliveryDays: veljavni pon-tor-sre...
// - parseJsonPayload: object only (ne array/string)
// - parseVatBreakdown: number-only values
// - parseStringArray: string-only filter
// - getJsonFieldStats: dashboard
// ============================================

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  safeJsonParse,
  safeJsonSerialize,
  safeParseJson,
  parseOrderItemModifiers,
  serializeOrderItemModifiers,
  parsePermissions,
  serializePermissions,
  parseWebhookEvents,
  parseAllergens,
  parseDeliveryDays,
  parseJsonPayload,
  parseVatBreakdown,
  parseStringArray,
  parseIntegrationConfig,
  isOrderItemModifier,
  isPermission,
  parsePrintRules,
  parseDaysOfWeek,
  toJsonWire,
  toJsonWireDeep,
  JSON_WIRE_FIELDS,
  JSON_FIELD_VERSION,
  detectPayloadVersion,
  migrateJsonPayload,
  JSON_FIELDS,
  getJsonFieldStats,
} from '@/lib/json-fields'

describe('safeJsonParse — Issue #33', () => {
  it('parses valid JSON', () => {
    expect(safeJsonParse('[1,2,3]', [])).toEqual([1, 2, 3])
    expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 })
  })

  it('returns fallback for malformed JSON', () => {
    expect(safeJsonParse('not-json', 'fallback')).toBe('fallback')
    expect(safeJsonParse('{invalid', [])).toEqual([])
    expect(safeJsonParse('', {})).toEqual({})
  })

  it('returns fallback for null/undefined/empty', () => {
    expect(safeJsonParse(null, [])).toEqual([])
    expect(safeJsonParse(undefined, 'fb')).toBe('fb')
    expect(safeJsonParse('   ', 'fb')).toBe('fb')
  })
})

describe('safeJsonSerialize — Issue #33', () => {
  it('serializes valid values', () => {
    expect(safeJsonSerialize([1, 2, 3])).toBe('[1,2,3]')
    expect(safeJsonSerialize({ a: 1 })).toBe('{"a":1}')
    expect(safeJsonSerialize('hello')).toBe('"hello"')
  })

  it('returns [] for circular references', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(safeJsonSerialize(circular)).toBe('[]')
  })
})

describe('parseOrderItemModifiers — Issue #33', () => {
  it('parses valid modifier array', () => {
    const json = JSON.stringify([
      { name: 'Sir', price: 1.5, quantity: 2 },
      { name: 'Slanina', price: 2 },
    ])
    const result = parseOrderItemModifiers(json)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Sir')
    expect(result[0].price).toBe(1.5)
  })

  it('returns [] for malformed JSON', () => {
    expect(parseOrderItemModifiers('not-json')).toEqual([])
    expect(parseOrderItemModifiers(null)).toEqual([])
    expect(parseOrderItemModifiers('')).toEqual([])
  })

  it('returns [] if parsed is not array', () => {
    expect(parseOrderItemModifiers('{"a":1}')).toEqual([])
    expect(parseOrderItemModifiers('"string"')).toEqual([])
    expect(parseOrderItemModifiers('42')).toEqual([])
  })

  it('serialize → parse roundtrip', () => {
    const mods = [{ name: 'Sir', price: 1.5 }, { name: 'Pepper', price: 0.5 }]
    const json = serializeOrderItemModifiers(mods)
    const parsed = parseOrderItemModifiers(json)
    expect(parsed).toEqual(mods)
  })
})

describe('parsePermissions — Issue #33', () => {
  it('parses valid permissions', () => {
    const result = parsePermissions(JSON.stringify(['admin', 'take_orders']))
    expect(result).toEqual(['admin', 'take_orders'])
  })

  it('filters out invalid permissions', () => {
    const result = parsePermissions(JSON.stringify(['admin', 'invalid_perm', 'take_orders', 42]))
    expect(result).toEqual(['admin', 'take_orders'])
  })

  it('returns [] for malformed JSON', () => {
    expect(parsePermissions('not-json')).toEqual([])
    expect(parsePermissions(null)).toEqual([])
  })

  it('serialize deduplicates permissions', () => {
    const json = serializePermissions(['admin', 'admin', 'take_orders', 'take_orders'])
    expect(JSON.parse(json)).toEqual(['admin', 'take_orders'])
  })
})

describe('parseWebhookEvents — Issue #33', () => {
  it('parses valid events', () => {
    const result = parseWebhookEvents(JSON.stringify(['order.created', 'order.paid']))
    expect(result).toEqual(['order.created', 'order.paid'])
  })

  it('filters out unknown events', () => {
    const result = parseWebhookEvents(JSON.stringify(['order.created', 'unknown.event']))
    expect(result).toEqual(['order.created'])
  })
})

describe('parseAllergens — Issue #33', () => {
  it('parses valid allergens (1-14)', () => {
    const result = parseAllergens(JSON.stringify(['1', '3', '14']))
    expect(result).toEqual(['1', '3', '14'])
  })

  it('filters out invalid allergen numbers (15+)', () => {
    const result = parseAllergens(JSON.stringify(['1', '15', 'abc', '3']))
    expect(result).toEqual(['1', '3'])
  })
})

describe('parseDeliveryDays — Issue #33', () => {
  it('parses valid days', () => {
    const result = parseDeliveryDays(JSON.stringify(['pon', 'sre', 'pet']))
    expect(result).toEqual(['pon', 'sre', 'pet'])
  })

  it('filters out invalid days', () => {
    const result = parseDeliveryDays(JSON.stringify(['pon', 'xyz', 'sre', 'monday']))
    expect(result).toEqual(['pon', 'sre'])
  })
})

describe('parseJsonPayload — Issue #33', () => {
  it('parses valid object', () => {
    expect(parseJsonPayload('{"action":"login","userId":"u1"}')).toEqual({
      action: 'login',
      userId: 'u1',
    })
  })

  it('returns {} for arrays (not objects)', () => {
    expect(parseJsonPayload('[1,2,3]')).toEqual({})
  })

  it('returns {} for strings/numbers', () => {
    expect(parseJsonPayload('"hello"')).toEqual({})
    expect(parseJsonPayload('42')).toEqual({})
  })

  it('returns {} for malformed JSON', () => {
    expect(parseJsonPayload('not-json')).toEqual({})
    expect(parseJsonPayload(null)).toEqual({})
  })
})

describe('parseVatBreakdown — Issue #33', () => {
  it('parses valid number values', () => {
    const result = parseVatBreakdown(JSON.stringify({ '22': 12.34, '9.5': 5.55 }))
    expect(result).toEqual({ '22': 12.34, '9.5': 5.55 })
  })

  it('converts string numbers to numbers', () => {
    const result = parseVatBreakdown(JSON.stringify({ '22': '10.50' }))
    expect(result).toEqual({ '22': 10.5 })
  })

  it('filters out non-numeric values', () => {
    const result = parseVatBreakdown(JSON.stringify({ '22': 10, '9.5': 'abc', '5': true }))
    expect(result).toEqual({ '22': 10 })
  })

  it('returns {} for arrays', () => {
    expect(parseVatBreakdown('[1,2,3]')).toEqual({})
  })
})

describe('parseStringArray — Issue #33', () => {
  it('parses string array', () => {
    expect(parseStringArray(JSON.stringify(['a', 'b', 'c']))).toEqual(['a', 'b', 'c'])
  })

  it('filters out non-strings', () => {
    expect(parseStringArray(JSON.stringify(['a', 1, 'b', true, null]))).toEqual(['a', 'b'])
  })

  it('returns [] for non-arrays', () => {
    expect(parseStringArray('{"a":1}')).toEqual([])
    expect(parseStringArray('"string"')).toEqual([])
  })
})

describe('parseIntegrationConfig — Issue #33', () => {
  it('parses config object', () => {
    const result = parseIntegrationConfig(JSON.stringify({ companyId: '123', autoSync: true }))
    expect(result).toEqual({ companyId: '123', autoSync: true })
  })

  it('returns {} for non-objects', () => {
    expect(parseIntegrationConfig('[1,2]')).toEqual({})
    expect(parseIntegrationConfig(null)).toEqual({})
  })
})

describe('isOrderItemModifier — type-guard', () => {
  it('prepozna veljaven modifier', () => {
    expect(isOrderItemModifier({ name: 'Sir', price: 1.5 })).toBe(true)
  })

  it('zavrne neveljaven modifier (manjka price)', () => {
    expect(isOrderItemModifier({ name: 'Sir' })).toBe(false)
  })

  it('zavrne null/undefined', () => {
    expect(isOrderItemModifier(null)).toBe(false)
    expect(isOrderItemModifier(undefined)).toBe(false)
    expect(isOrderItemModifier('string')).toBe(false)
  })
})

describe('isPermission — type-guard', () => {
  it('prepozna veljavne permissions', () => {
    expect(isPermission('admin')).toBe(true)
    expect(isPermission('take_orders')).toBe(true)
    expect(isPermission('view_reports')).toBe(true)
  })

  it('zavrne neveljavne permissions', () => {
    expect(isPermission('superuser')).toBe(false)
    expect(isPermission('admin ')).toBe(false) // trailing space
    expect(isPermission('ADMIN')).toBe(false) // case-sensitive
  })
})

describe('JSON_FIELDS inventory — Issue #33', () => {
  it('vsebuje OrderItem.modifiersJson', () => {
    const modifiersField = JSON_FIELDS.find((f) => f.model === 'OrderItem' && f.field === 'modifiersJson')
    expect(modifiersField).toBeDefined()
    expect(modifiersField?.type).toBe('array')
    expect(modifiersField?.parser).toBe('parseOrderItemModifiers')
  })

  it('ima vsaj 20 polj (audit trdi 20+)', () => {
    expect(JSON_FIELDS.length).toBeGreaterThanOrEqual(20)
  })

  it('vsa polja imajo parser funkcijo definirano', () => {
    for (const field of JSON_FIELDS) {
      expect(field.parser).toBeTruthy()
      expect(typeof field.parser).toBe('string')
    }
  })

  it('vsa polja so array ali object', () => {
    for (const field of JSON_FIELDS) {
      expect(['array', 'object']).toContain(field.type)
    }
  })
})

describe('getJsonFieldStats — migracijski dashboard', () => {
  it('vrne strukturo s števci', () => {
    const stats = getJsonFieldStats()
    expect(stats).toHaveProperty('totalFields')
    expect(stats).toHaveProperty('arrayFields')
    expect(stats).toHaveProperty('objectFields')
    expect(stats).toHaveProperty('modelsAffected')
    expect(stats).toHaveProperty('hasHelpers')
    expect(stats).toHaveProperty('usesPrismaJson')
    expect(stats).toHaveProperty('recommendations')
  })

  it('totalFields >= 20', () => {
    const stats = getJsonFieldStats()
    expect(stats.totalFields).toBeGreaterThanOrEqual(20)
  })

  it('arrayFields + objectFields === totalFields', () => {
    const stats = getJsonFieldStats()
    expect(stats.arrayFields + stats.objectFields).toBe(stats.totalFields)
  })

  it('hasHelpers je true (Phase 1 končan)', () => {
    const stats = getJsonFieldStats()
    expect(stats.hasHelpers).toBe(true)
  })

  it('usesPrismaJson je true (R150 #33: Phase 3 KONČAN — 0022_json_fields)', () => {
    const stats = getJsonFieldStats()
    expect(stats.usesPrismaJson).toBe(true)
  })

  it('recommendations vključuje Phase 3 načrt', () => {
    const stats = getJsonFieldStats()
    expect(stats.recommendations.some((r) => r.includes('Phase 3'))).toBe(true)
  })

  it('recommendations poroča o zaključeni migraciji 0022_json_fields', () => {
    const stats = getJsonFieldStats()
    expect(stats.recommendations.some((r) => r.includes('0022_json_fields'))).toBe(true)
  })

  it('modelsAffected >= 10 (veliko modelov)', () => {
    const stats = getJsonFieldStats()
    expect(stats.modelsAffected).toBeGreaterThanOrEqual(10)
  })
})

// ════════════════════════════════════════════════════════════════
// P1-9 RAZŠIRITEV — Zod validacija, tolerantni parserji, verzioniranje
// ════════════════════════════════════════════════════════════════

describe('P1-9: safeParseJson — vzorec schema.parse(JSON.parse(value))', () => {
  const numberArraySchema = z.array(z.number())

  it('veljaven JSON + veljavna struktura → podatki', () => {
    const result = safeParseJson(numberArraySchema, '[1,2,3]', [])
    expect(result).toEqual([1, 2, 3])
  })

  it('veljaven JSON ampak napačna struktura → fallback', () => {
    const result = safeParseJson(numberArraySchema, '{"a":1}', [])
    expect(result).toEqual([])
  })

  it('malformed JSON → fallback (nikoli throw)', () => {
    expect(() => safeParseJson(numberArraySchema, 'ne-veljaven{', [])).not.toThrow()
    expect(safeParseJson(numberArraySchema, 'ne-veljaven{', [])).toEqual([])
  })

  it('fallback se uporabi tudi za prazen/null vhod', () => {
    expect(safeParseJson(numberArraySchema, null, [])).toEqual([])
    expect(safeParseJson(numberArraySchema, '', [])).toEqual([])
  })
})

describe('P1-9: parseAllergens — CSV fallback (MenuItem legacy format)', () => {
  it('CSV "1,3,7" se normalizira v array (mobile menu fix)', () => {
    expect(parseAllergens('1,3,7')).toEqual(['1', '3', '7'])
  })

  it('CSV z neveljavnimi vnosi se filtrira', () => {
    expect(parseAllergens('1,abc,15,,7')).toEqual(['1', '7'])
  })

  it('prazen string → [] (MenuItem default)', () => {
    expect(parseAllergens('')).toEqual([])
  })

  it('JSON array ostane JSON array', () => {
    expect(parseAllergens('["1","3"]')).toEqual(['1', '3'])
  })
})

describe('P1-9: parseDaysOfWeek — [1..7]', () => {
  it('parsira veljavne dneve', () => {
    expect(parseDaysOfWeek('[1,2,3,4,5]')).toEqual([1, 2, 3, 4, 5])
  })

  it('filtrira neveljavne dneve (0.5, 8, string)', () => {
    expect(parseDaysOfWeek('[1,0.5,8,"2",7]')).toEqual([1, 7])
  })

  it('malformed JSON → [] (nikoli throw — happy-hour route fix)', () => {
    expect(parseDaysOfWeek('neveljaven')).toEqual([])
    expect(parseDaysOfWeek(null)).toEqual([])
  })
})

describe('P1-9: parsePrintRules — Printer.printRules', () => {
  it('parsira veljavna pravila', () => {
    const json = JSON.stringify([
      { type: 'order', prepStationId: 'ps-1' },
      { type: 'receipt', port: 9100 },
    ])
    expect(parsePrintRules(json)).toEqual([
      { type: 'order', prepStationId: 'ps-1' },
      { type: 'receipt', port: 9100 },
    ])
  })

  it('izloči element brez type (neveljaven)', () => {
    const json = JSON.stringify([{ type: 'order' }, { prepStationId: 'x' }, { port: 1 }])
    expect(parsePrintRules(json)).toEqual([{ type: 'order' }])
  })

  it('malformed JSON → [] (printer routing ne sesuje)', () => {
    expect(parsePrintRules('{broken')).toEqual([])
  })
})

describe('P1-9: parseVatBreakdown — Receipt format {"22": {base, vat}}', () => {
  it('sprejme Receipt format z objekti (FURS fiskalni podatek)', () => {
    const json = JSON.stringify({ '22': { base: 10.0, vat: 2.2 }, '9.5': { base: 5.0, vat: 0.475 } })
    const result = parseVatBreakdown(json)
    expect(result['22']).toEqual({ base: 10.0, vat: 2.2 })
    expect(result['9.5']).toEqual({ base: 5.0, vat: 0.475 })
  })

  it('sprejme tudi čisti number format (Order)', () => {
    const result = parseVatBreakdown(JSON.stringify({ '22': 12.34 }))
    expect(result['22']).toBe(12.34)
  })

  it('malformed JSON → {} (digital-receipt / receipt-print fix)', () => {
    expect(parseVatBreakdown('ni-json')).toEqual({})
  })

  it('array format → {} (ne-object)', () => {
    expect(parseVatBreakdown('[1,2]')).toEqual({})
  })

  it('per-entry filter: neveljaven entry ne uniči veljavnih', () => {
    const json = JSON.stringify({ '22': 10, 'abc': 5, '9.5': { base: 1, vat: 0.095 } })
    const result = parseVatBreakdown(json)
    expect(Object.keys(result)).toEqual(['22', '9.5'])
  })
})

describe('P1-9: verzioniranje JSON payload-ov', () => {
  it('JSON_FIELD_VERSION = 1 (trenutni format)', () => {
    expect(JSON_FIELD_VERSION).toBe(1)
  })

  it('detectPayloadVersion: brez envelope-a → 1', () => {
    expect(detectPayloadVersion([1, 2])).toBe(1)
    expect(detectPayloadVersion({ a: 1 })).toBe(1)
    expect(detectPayloadVersion('string')).toBe(1)
  })

  it('detectPayloadVersion: {"version": 2} → 2', () => {
    expect(detectPayloadVersion({ version: 2 })).toBe(2)
    expect(detectPayloadVersion({ version: 3, items: [] })).toBe(3)
  })

  it('migrateJsonPayload: verzija 1 → identity migracija', () => {
    const result = migrateJsonPayload([1, 2], { 1: (raw) => (raw as number[]) })
    expect(result).toEqual([1, 2])
  })

  it('migrateJsonPayload: V2 format se migrira na V1', () => {
    // simulacija: prihodnja sprememba doda envelope
    const v2Payload = { version: 2, items: [{ name: 'Sir', price: 1.5 }] }
    const result = migrateJsonPayload(v2Payload, {
      2: (raw) => (raw as { items: unknown[] }).items,
    })
    expect(result).toEqual([{ name: 'Sir', price: 1.5 }])
  })

  it('migrateJsonPayload: neznana verzija → throw (fail-safe nadzorovano)', () => {
    expect(() =>
      migrateJsonPayload({ version: 99 }, { 1: (raw) => raw }),
    ).toThrow(/Neznana verzija/)
  })
})

describe('P1-9: parseOrderItemModifiers — per-element filter', () => {
  it('izloči pokvarjen element, ohrani veljavne (finančni podatki!)', () => {
    const json = JSON.stringify([
      { name: 'Sir', price: 1.5 },
      { name: 'Brez cene' }, // manjka price → neveljaven
      { price: 2 }, // manjka name → neveljaven
      { name: 'Slanina', price: 2, quantity: 2, id: 'mod-1', modifierGroupId: 'mg-1' },
    ])
    const result = parseOrderItemModifiers(json)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ name: 'Sir', price: 1.5 })
    expect(result[1]).toEqual({ name: 'Slanina', price: 2, quantity: 2, id: 'mod-1', modifierGroupId: 'mg-1' })
  })

  it('id polje preživi parse (server-side DB price lookup potrebuje)', () => {
    const result = parseOrderItemModifiers(JSON.stringify([{ id: 'mod-7', name: 'Ekstra', price: 0.5 }]))
    expect(result[0].id).toBe('mod-7')
  })
})

// ════════════════════════════════════════════════════════════════
// R150 (#33) RAZŠIRITEV — JsonValue-toleranca (native JSONB vhodi) +
// wire mapping (toJsonWire/toJsonWireDeep). Po 0022_json_fields Prisma
// vrača/sprejema NATIVNE struct vrednosti — vsi parserji sprejmejo OBE
// obliki (legacy JSON string ALI native struct), wire API-jev pa ostane
// JSON string (toJsonWire preslika SAMO znana wire polja).
// ════════════════════════════════════════════════════════════════

describe('R150: tolerantni parserji — native struct (JSONB) vhodi', () => {
  it('parseOrderItemModifiers sprejme native array', () => {
    const native = [{ name: 'Sir', price: 1.5 }, { name: 'Slanina', price: 2 }]
    expect(parseOrderItemModifiers(native)).toEqual(native)
  })

  it('parsePermissions sprejme native array (Job/Session.permissions po 0022)', () => {
    expect(parsePermissions(['admin', 'take_orders', 'invalid_perm', 42])).toEqual(['admin', 'take_orders'])
  })

  it('parseWebhookEvents sprejme native array', () => {
    expect(parseWebhookEvents(['order.created', 'unknown.event'])).toEqual(['order.created'])
  })

  it('parseAllergens sprejme native array (Guest.allergens je JSONB)', () => {
    expect(parseAllergens(['1', '15', 'abc', '3'])).toEqual(['1', '3'])
  })

  it('parseDeliveryDays sprejme native array', () => {
    expect(parseDeliveryDays(['pon', 'xyz', 'sre'])).toEqual(['pon', 'sre'])
  })

  it('parseDaysOfWeek sprejme native array (HappyHourSchedule po 0022)', () => {
    expect(parseDaysOfWeek([1, 0.5, 8, '2', 7])).toEqual([1, 7])
  })

  it('parseJsonPayload sprejme native object', () => {
    expect(parseJsonPayload({ action: 'login', userId: 'u1' })).toEqual({ action: 'login', userId: 'u1' })
  })

  it('parseVatBreakdown sprejme native object (Receipt.vatBreakdown po 0022)', () => {
    expect(parseVatBreakdown({ '22': 12.34, '9.5': { base: 5, vat: 0.475 } })).toEqual({
      '22': 12.34,
      '9.5': { base: 5, vat: 0.475 },
    })
  })

  it('parseStringArray sprejme native array', () => {
    expect(parseStringArray(['a', 1, 'b', true, null])).toEqual(['a', 'b'])
  })

  it('parseIntegrationConfig sprejme native object (Integration.config po 0022)', () => {
    expect(parseIntegrationConfig({ companyId: '123', autoSync: true })).toEqual({ companyId: '123', autoSync: true })
  })

  it('parsePrintRules sprejme native array (Printer.printRules po 0022)', () => {
    expect(parsePrintRules([{ type: 'order', prepStationId: 'ps-1' }])).toEqual([
      { type: 'order', prepStationId: 'ps-1' },
    ])
  })

  it('safeParseJson sprejme native struct (brez JSON.parse poti, Zod odloča)', () => {
    const numberArraySchema = z.array(z.number())
    expect(safeParseJson(numberArraySchema, [1, 2, 3], [])).toEqual([1, 2, 3])
    expect(safeParseJson(numberArraySchema, { a: 1 }, [])).toEqual([])
  })

  it('string in native vhod data ISTI rezultat (tolerantna pariteta)', () => {
    const legacy = JSON.stringify(['pon', 'sre'])
    expect(parseDeliveryDays(legacy)).toEqual(parseDeliveryDays(['pon', 'sre']))
  })
})

describe('R150: normalizeJsonInput robovi (prek javnih parserjev)', () => {
  it('prazen string → fallback (legacy DEFAULT(\'\') vrstice)', () => {
    expect(safeJsonParse('', ['fb'])).toEqual(['fb'])
    expect(safeJsonParse('   ', 'fb')).toBe('fb')
    expect(parseStringArray('')).toEqual([])
  })

  it('malformed JSON string → fallback, NIKOLI throw', () => {
    expect(safeJsonParse('{broken', 'fb')).toBe('fb')
    expect(safeJsonParse('not-json', 'fb')).toBe('fb')
    expect(parseVatBreakdown('ni-json')).toEqual({})
    expect(parseOrderItemModifiers('{incomplete')).toEqual([])
  })

  it('null/undefined → fallback', () => {
    expect(safeJsonParse(null, 'fb')).toBe('fb')
    expect(safeJsonParse(undefined, 'fb')).toBe('fb')
    expect(parseIntegrationConfig(null)).toEqual({})
    expect(parseIntegrationConfig(undefined)).toEqual({})
  })

  it('primitivni native vhodi (number/boolean) gredo 1:1 skozi (Zod/oblika odloči)', () => {
    expect(safeJsonParse(42, 'fb')).toBe(42)
    expect(safeJsonParse(true, 'fb')).toBe(true)
    // primitiv ni array/object → poljski parserji vrnejo fallback
    expect(parseStringArray(42)).toEqual([])
    expect(parseVatBreakdown(42)).toEqual({})
    expect(parseOrderItemModifiers(42)).toEqual([])
  })
})

describe('R150: toJsonWire — struct → JSON string (SAMO wire polja)', () => {
  it('stringify-a SAMO JSON_WIRE_FIELDS struct vrednosti', () => {
    const row = { id: 'j1', name: 'Kuhinja', permissions: ['admin'], printRules: [{ type: 'receipt' }] }
    const wire = toJsonWire(row) as Record<string, unknown>
    expect(wire.permissions).toBe('["admin"]')
    expect(wire.printRules).toBe('[{"type":"receipt"}]')
    expect(wire.name).toBe('Kuhinja') // non-wire polje nedotaknjeno
    expect(wire.id).toBe('j1')
  })

  it('string vrednosti ostanejo nespremenjene (že-wire / legacy / CSV)', () => {
    const row = { permissions: '["admin"]', allergens: '1,3', vatBreakdown: '{}', details: '{"a":1}' }
    const wire = toJsonWire(row) as Record<string, unknown>
    expect(wire.permissions).toBe('["admin"]')
    expect(wire.allergens).toBe('1,3')
    expect(wire.vatBreakdown).toBe('{}')
    expect(wire.details).toBe('{"a":1}') // DEFER stolpec (byte-pinned) — ni wire polje
  })

  it('null/undefined wire polja se pustijo (nikoli "null" string)', () => {
    const wire = toJsonWire({ permissions: null, printRules: undefined }) as Record<string, unknown>
    expect(wire.permissions).toBeNull()
    expect(wire.printRules).toBeUndefined()
  })

  it('ne-object vhodi gredo 1:1 (string, null, array)', () => {
    expect(toJsonWire('str' as never)).toBe('str')
    expect(toJsonWire(null)).toBeNull()
    expect(toJsonWire([1, 2] as never)).toEqual([1, 2])
  })

  it('toJsonWireDeep: nested vrstice (include-i) se preslikajo rekurzivno', () => {
    const data = {
      id: 'g1',
      favoriteItems: ['pizza'],
      visits: [{ id: 'v1', tags: ['x'], config: { a: 1 } }],
    }
    const wire = toJsonWireDeep(data) as unknown as { favoriteItems: string; visits: Array<{ tags: string; config: string }> }
    expect(wire.favoriteItems).toBe('["pizza"]')
    expect(wire.visits[0].tags).toBe('["x"]')
    expect(wire.visits[0].config).toBe('{"a":1}')
    expect(JSON.parse(wire.visits[0].config)).toEqual({ a: 1 })
  })

  it('toJsonWireDeep: Date/[[Primitive]] razredi ostanejo nedotaknjeni', () => {
    const d = new Date('2026-01-01T00:00:00.000Z')
    const wire = toJsonWireDeep({ createdAt: d, items: [{ tags: ['a'] }] }) as unknown as { createdAt: Date; items: Array<{ tags: string }> }
    expect(wire.createdAt).toBe(d)
    expect(wire.items[0].tags).toBe('["a"]')
  })

  it('JSON_WIRE_FIELDS ne vsebuje legacy/DEFER stolpcev (modifiersJson, details, payload, apiKeys)', () => {
    expect(JSON_WIRE_FIELDS.has('modifiersJson')).toBe(false) // legacy dual-write string wire
    expect(JSON_WIRE_FIELDS.has('details')).toBe(false) // AuditLog.details — DEFER
    expect(JSON_WIRE_FIELDS.has('payload')).toBe(false) // WebhookDelivery.payload — DEFER
    expect(JSON_WIRE_FIELDS.has('apiKeys')).toBe(false) // RestaurantSettings.apiKeys — DEFER
  })
})
