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
import {
  safeJsonParse,
  safeJsonSerialize,
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

  it('usesPrismaJson je false (Phase 3 še ni narejen)', () => {
    const stats = getJsonFieldStats()
    expect(stats.usesPrismaJson).toBe(false)
  })

  it('recommendations vključuje Phase 3 načrt', () => {
    const stats = getJsonFieldStats()
    expect(stats.recommendations.some((r) => r.includes('Phase 3'))).toBe(true)
  })

  it('modelsAffected >= 10 (veliko modelov)', () => {
    const stats = getJsonFieldStats()
    expect(stats.modelsAffected).toBeGreaterThanOrEqual(10)
  })
})
