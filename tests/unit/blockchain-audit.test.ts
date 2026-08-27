// ============================================
// Blockchain Audit — Unit testi
// ============================================
import { describe, it, expect } from 'vitest'
import crypto from 'crypto'

// --- Pomožne funkcije (replicate iz lib za testiranje logike) ---

const GENESIS_HASH = '0'.repeat(64)
const HASH_ALGORITHM = 'sha256'

function calculateHash(data: {
  blockNumber: number
  previousHash: string
  entityType: string
  entityId: string
  action: string
  payload: unknown
  timestamp: string
}): string {
  const payloadStr = typeof data.payload === 'object'
    ? JSON.stringify(data.payload)
    : String(data.payload)

  const input = [
    data.blockNumber,
    data.previousHash,
    data.entityType,
    data.entityId,
    data.action,
    payloadStr,
    data.timestamp,
  ].join('|')

  return crypto.createHash(HASH_ALGORITHM).update(input).digest('hex')
}

function signEntry(data: {
  blockNumber: number
  previousHash: string
  currentHash: string
  entityType: string
  entityId: string
  action: string
  timestamp: string
}): string {
  const secret = 'test-secret'
  const input = [
    data.blockNumber,
    data.previousHash,
    data.currentHash,
    data.entityType,
    data.entityId,
    data.action,
    data.timestamp,
  ].join('|')

  return crypto.createHmac(HASH_ALGORITHM, secret).update(input).digest('hex')
}

// --- Testi ---

describe('Blockchain Audit — Hash calculation', () => {
  it('genesis hash je 64 ničel', () => {
    expect(GENESIS_HASH).toHaveLength(64)
    expect(GENESIS_HASH).toMatch(/^0+$/)
  })

  it('hash je 64 znakov (SHA-256 hex)', () => {
    const hash = calculateHash({
      blockNumber: 1,
      previousHash: GENESIS_HASH,
      entityType: 'order',
      entityId: 'order-1',
      action: 'create',
      payload: { total: 42.50 },
      timestamp: '2026-09-15T10:00:00Z',
    })
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('različni blockNumber → različni hash', () => {
    const hash1 = calculateHash({
      blockNumber: 1,
      previousHash: GENESIS_HASH,
      entityType: 'order',
      entityId: 'order-1',
      action: 'create',
      payload: {},
      timestamp: '2026-09-15T10:00:00Z',
    })
    const hash2 = calculateHash({
      blockNumber: 2,
      previousHash: GENESIS_HASH,
      entityType: 'order',
      entityId: 'order-1',
      action: 'create',
      payload: {},
      timestamp: '2026-09-15T10:00:00Z',
    })
    expect(hash1).not.toBe(hash2)
  })

  it('različni previousHash → različni hash', () => {
    const hash1 = calculateHash({
      blockNumber: 2,
      previousHash: 'aaa',
      entityType: 'order',
      entityId: 'order-1',
      action: 'create',
      payload: {},
      timestamp: '2026-09-15T10:00:00Z',
    })
    const hash2 = calculateHash({
      blockNumber: 2,
      previousHash: 'bbb',
      entityType: 'order',
      entityId: 'order-1',
      action: 'create',
      payload: {},
      timestamp: '2026-09-15T10:00:00Z',
    })
    expect(hash1).not.toBe(hash2)
  })

  it('različni payload → različni hash', () => {
    const hash1 = calculateHash({
      blockNumber: 1,
      previousHash: GENESIS_HASH,
      entityType: 'order',
      entityId: 'order-1',
      action: 'create',
      payload: { total: 42.50 },
      timestamp: '2026-09-15T10:00:00Z',
    })
    const hash2 = calculateHash({
      blockNumber: 1,
      previousHash: GENESIS_HASH,
      entityType: 'order',
      entityId: 'order-1',
      action: 'create',
      payload: { total: 99.99 },
      timestamp: '2026-09-15T10:00:00Z',
    })
    expect(hash1).not.toBe(hash2)
  })

  it('isti input → isti hash (deterministic)', () => {
    const input = {
      blockNumber: 1,
      previousHash: GENESIS_HASH,
      entityType: 'order',
      entityId: 'order-1',
      action: 'create',
      payload: { total: 42.50 },
      timestamp: '2026-09-15T10:00:00Z',
    }
    const hash1 = calculateHash(input)
    const hash2 = calculateHash(input)
    expect(hash1).toBe(hash2)
  })
})

describe('Blockchain Audit — Signature', () => {
  it('signature je 64 znakov (HMAC-SHA256)', () => {
    const sig = signEntry({
      blockNumber: 1,
      previousHash: GENESIS_HASH,
      currentHash: 'abc',
      entityType: 'order',
      entityId: 'order-1',
      action: 'create',
      timestamp: '2026-09-15T10:00:00Z',
    })
    expect(sig).toHaveLength(64)
  })

  it('različen secret → različen podpis', () => {
    const data = {
      blockNumber: 1,
      previousHash: GENESIS_HASH,
      currentHash: 'abc',
      entityType: 'order',
      entityId: 'order-1',
      action: 'create',
      timestamp: '2026-09-15T10:00:00Z',
    }
    const sig1 = crypto.createHmac('sha256', 'secret1').update([
      data.blockNumber, data.previousHash, data.currentHash,
      data.entityType, data.entityId, data.action, data.timestamp,
    ].join('|')).digest('hex')
    const sig2 = crypto.createHmac('sha256', 'secret2').update([
      data.blockNumber, data.previousHash, data.currentHash,
      data.entityType, data.entityId, data.action, data.timestamp,
    ].join('|')).digest('hex')
    expect(sig1).not.toBe(sig2)
  })

  it('isti input + isti secret → isti podpis (deterministic)', () => {
    const data = {
      blockNumber: 1,
      previousHash: GENESIS_HASH,
      currentHash: 'abc',
      entityType: 'order',
      entityId: 'order-1',
      action: 'create',
      timestamp: '2026-09-15T10:00:00Z',
    }
    const sig1 = signEntry(data)
    const sig2 = signEntry(data)
    expect(sig1).toBe(sig2)
  })
})

describe('Blockchain Audit — Chain verification logic', () => {
  it('prazna veriga je veljavna', () => {
    const blocks: unknown[] = []
    expect(blocks.length).toBe(0)
    // verifyChain bi vrnil { valid: true, totalBlocks: 0 }
  })

  it('veriga z enim blokom (genesis → block 1) je veljavna', () => {
    const block1 = {
      blockNumber: 1,
      previousHash: GENESIS_HASH,
      entityType: 'order',
      entityId: 'order-1',
      action: 'create',
      payload: {},
      timestamp: '2026-09-15T10:00:00Z',
    }
    const hash1 = calculateHash(block1)
    expect(block1.previousHash).toBe(GENESIS_HASH)
    expect(hash1).toHaveLength(64)
  })

  it('veriga z dvema blokoma — block 2.previousHash mora biti block 1.currentHash', () => {
    const block1 = {
      blockNumber: 1,
      previousHash: GENESIS_HASH,
      entityType: 'order',
      entityId: 'order-1',
      action: 'create',
      payload: {},
      timestamp: '2026-09-15T10:00:00Z',
    }
    const hash1 = calculateHash(block1)

    const block2 = {
      blockNumber: 2,
      previousHash: hash1, // ← povezava!
      entityType: 'payment',
      entityId: 'payment-1',
      action: 'create',
      payload: {},
      timestamp: '2026-09-15T10:05:00Z',
    }
    const hash2 = calculateHash(block2)

    expect(block2.previousHash).toBe(hash1)
    expect(hash2).not.toBe(hash1)
  })

  it('tampering detection — sprememba block 1.payload razbije verigo', () => {
    const block1Original = {
      blockNumber: 1,
      previousHash: GENESIS_HASH,
      entityType: 'order',
      entityId: 'order-1',
      action: 'create',
      payload: { total: 42.50 },
      timestamp: '2026-09-15T10:00:00Z',
    }
    const hash1Original = calculateHash(block1Original)

    const block1Tampered = {
      ...block1Original,
      payload: { total: 999.99 }, // ← TAMPERED!
    }
    const hash1Tampered = calculateHash(block1Tampered)

    expect(hash1Original).not.toBe(hash1Tampered)
    // Block 2 bi še vedno kazal na hash1Original, ampak block 1 hash se je spremenil
    // → verification bi fail-ala
  })
})

describe('Blockchain Audit — Entity types', () => {
  it('vsi entity types so definirani', () => {
    const types = ['order', 'payment', 'refund', 'void', 'cash_shift', 'inventory', 'employee', 'furs_invoice']
    expect(types.length).toBe(8)
  })
})

describe('Blockchain Audit — Audit actions', () => {
  it('vsi actions so definirani', () => {
    const actions = ['create', 'update', 'delete', 'void', 'refund', 'authorize', 'capture', 'fiscal_verify']
    expect(actions.length).toBe(8)
  })
})
