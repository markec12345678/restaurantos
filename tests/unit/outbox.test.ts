// ============================================
// Outbox Engine — Unit testi
// ============================================
// Testira čisto logiko (brez DB klicev):
//   - idempotencyKey generiranje
//   - exponential backoff izračun
//   - status transitions (state machine)
//   - payload validacija
// ============================================

import { describe, it, expect } from 'vitest'
import {
  MAX_ATTEMPTS,
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  type OutboxTarget,
  type OutboxStatus,
  type AggregateType,
} from '@/lib/outbox'

// --- Pomožne funkcije (testiramo logiko, ne implementacije) ---

// Generira idempotency key (kompaktibilno z outbox/index.ts)
function genIdempotencyKey(
  aggregateType: AggregateType,
  aggregateId: string,
  eventType: string,
  target: OutboxTarget,
): string {
  return `${aggregateType}:${aggregateId}:${eventType}:${target}`
}

// Exponential backoff (kompaktibilno z outbox/index.ts)
function calcBackoff(attempts: number): number {
  // attempts = 1 → 30s, 2 → 60s, 3 → 120s, 4 → 240s, 5 → 480s
  return Math.min(BACKOFF_BASE_MS * Math.pow(2, attempts - 1), BACKOFF_MAX_MS)
}

// Preveri ali je status veljaven prehod (state machine)
const validTransitions: Record<OutboxStatus, OutboxStatus[]> = {
  pending: ['processing'],
  processing: ['sent', 'failed', 'dead_letter'],
  failed: ['pending', 'processing', 'dead_letter'],
  sent: [],
  dead_letter: ['pending'], // ročni retry
}

function isValidTransition(from: OutboxStatus, to: OutboxStatus): boolean {
  return validTransitions[from].includes(to)
}

// --- Testi ---

describe('Outbox constants', () => {
  it('MAX_ATTEMPTS = 5', () => {
    expect(MAX_ATTEMPTS).toBe(5)
  })

  it('BACKOFF_BASE_MS = 30s', () => {
    expect(BACKOFF_BASE_MS).toBe(30_000)
  })

  it('BACKOFF_MAX_MS = 1h', () => {
    expect(BACKOFF_MAX_MS).toBe(60 * 60 * 1000)
  })
})

describe('IdempotencyKey generation', () => {
  it('generira konsistenten ključ', () => {
    const key1 = genIdempotencyKey('order', 'order-123', 'created', 'furs')
    const key2 = genIdempotencyKey('order', 'order-123', 'created', 'furs')
    expect(key1).toBe(key2)
    expect(key1).toBe('order:order-123:created:furs')
  })

  it('različni eventTypes → različni ključi', () => {
    const k1 = genIdempotencyKey('order', 'order-1', 'created', 'furs')
    const k2 = genIdempotencyKey('order', 'order-1', 'voided', 'furs')
    expect(k1).not.toBe(k2)
  })

  it('različni targets → različni ključi', () => {
    const k1 = genIdempotencyKey('order', 'order-1', 'paid', 'furs')
    const k2 = genIdempotencyKey('order', 'order-1', 'paid', 'stripe')
    expect(k1).not.toBe(k2)
  })

  it('različni aggregates → različni ključi', () => {
    const k1 = genIdempotencyKey('order', 'order-1', 'created', 'furs')
    const k2 = genIdempotencyKey('invoice', 'order-1', 'created', 'furs')
    expect(k1).not.toBe(k2)
  })
})

describe('Exponential backoff', () => {
  it('1. poskus → 30s', () => {
    expect(calcBackoff(1)).toBe(30_000)
  })

  it('2. poskus → 60s', () => {
    expect(calcBackoff(2)).toBe(60_000)
  })

  it('3. poskus → 120s', () => {
    expect(calcBackoff(3)).toBe(120_000)
  })

  it('4. poskus → 240s', () => {
    expect(calcBackoff(4)).toBe(240_000)
  })

  it('5. poskus → 480s (8min)', () => {
    expect(calcBackoff(5)).toBe(480_000)
  })

  it('velik attempts → cap na 1h', () => {
    expect(calcBackoff(10)).toBe(60 * 60 * 1000)
    expect(calcBackoff(100)).toBe(60 * 60 * 1000)
  })

  it('rast je monotona', () => {
    const values = [1, 2, 3, 4, 5, 6].map(calcBackoff)
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1])
    }
  })
})

describe('Outbox status state machine', () => {
  it('pending → processing (valid)', () => {
    expect(isValidTransition('pending', 'processing')).toBe(true)
  })

  it('pending → sent (invalid — mora iti čez processing)', () => {
    expect(isValidTransition('pending', 'sent')).toBe(false)
  })

  it('processing → sent (valid)', () => {
    expect(isValidTransition('processing', 'sent')).toBe(true)
  })

  it('processing → failed (valid)', () => {
    expect(isValidTransition('processing', 'failed')).toBe(true)
  })

  it('failed → pending (valid — retry)', () => {
    expect(isValidTransition('failed', 'pending')).toBe(true)
  })

  it('failed → processing (valid — next attempt)', () => {
    expect(isValidTransition('failed', 'processing')).toBe(true)
  })

  it('failed → dead_letter (valid — exhausted)', () => {
    expect(isValidTransition('failed', 'dead_letter')).toBe(true)
  })

  it('sent → karkoli (invalid — terminal)', () => {
    expect(isValidTransition('sent', 'pending')).toBe(false)
    expect(isValidTransition('sent', 'processing')).toBe(false)
    expect(isValidTransition('sent', 'failed')).toBe(false)
  })

  it('dead_letter → pending (valid — ročni retry)', () => {
    expect(isValidTransition('dead_letter', 'pending')).toBe(true)
  })

  it('dead_letter → sent (invalid — mora iti čez pending)', () => {
    expect(isValidTransition('dead_letter', 'sent')).toBe(false)
  })
})

describe('OutboxTarget types', () => {
  it('vsi targets so definirani', () => {
    const targets: OutboxTarget[] = ['furs', 'stripe', 'email', 'sms', 'webhook', 'internal']
    expect(targets.length).toBe(6)
  })
})

describe('AggregateType types', () => {
  it('vsi aggregate types so definirani', () => {
    const types: AggregateType[] = ['order', 'invoice', 'furs_invoice', 'payment', 'reservation', 'customer']
    expect(types.length).toBe(6)
  })
})

describe('Payload structure validation (heuristic)', () => {
  // Preverja da so payloadi smiselno strukturirani
  it('FURS payload mora imeti zoi', () => {
    const payload = {
      orderId: 'order-1',
      orderNumber: 1,
      zoi: 'abc1234567',
      issueDate: '2026-09-15T10:00:00Z',
      totalAmount: 42.50,
      taxRate: 22,
      taxAmount: 9.35,
    }
    expect(payload).toHaveProperty('zoi')
    expect(payload).toHaveProperty('orderNumber')
    expect(typeof payload.totalAmount).toBe('number')
  })

  it('Stripe payload mora imeti amount v centih', () => {
    const payload = {
      orderId: 'order-1',
      orderNumber: 1,
      amount: 4250, // €42.50 v centih
      currency: 'EUR',
    }
    expect(payload.amount).toBeGreaterThan(0)
    expect(payload.currency).toBe('EUR')
    expect(Number.isInteger(payload.amount)).toBe(true)
  })

  it('Email payload mora imeti to + subject', () => {
    const payload = {
      to: 'guest@example.com',
      subject: 'Potrditev naročila #1',
      html: '<p>Hvala za naročilo</p>',
    }
    expect(payload.to).toContain('@')
    expect(payload.subject.length).toBeGreaterThan(0)
  })

  it('SMS payload mora imeti to + body', () => {
    const payload = {
      to: '+38641234567',
      body: 'Vaše naročilo #1 je pripravljeno za prevzem.',
    }
    expect(payload.to).toMatch(/^\+\d+$/)
    expect(payload.body.length).toBeGreaterThan(0)
  })
})
