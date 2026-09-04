// ============================================
// BLOCKCHAIN AUDIT — Tamper-evident hash chain
// ============================================
// Za FURS/PCI compliance — vsaka kritična transakcija
// je zabeležena z hash chain ( podobno kot Bitcoin).
//
// Lastnosti:
//   - Vsak blok vsebuje hash prejšnjega
//   - Sprememba kateregakoli bloka razbije chain
//   - Verification: preveri celotno verigo
//
// Hash formula:
//   hash = SHA256(blockNumber + previousHash + entityType + entityId + action + payload + timestamp)
// ============================================

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

// --- Tipi ---
export type AuditEntityType = 'order' | 'payment' | 'refund' | 'void' | 'cash_shift' | 'inventory' | 'employee' | 'furs_invoice'
export type AuditAction = 'create' | 'update' | 'delete' | 'void' | 'refund' | 'authorize' | 'capture' | 'fiscal_verify'

export interface AuditEntry {
  entityType: AuditEntityType
  entityId: string
  action: AuditAction
  payload: Record<string, unknown>
  minerId?: string
}

export interface BlockchainEntry {
  id: string
  blockNumber: number
  previousHash: string
  currentHash: string
  entityType: string
  entityId: string
  action: string
  payload: unknown
  signature: string
  timestamp: Date
  minerId?: string
}

export interface ChainVerificationResult {
  valid: boolean
  totalBlocks: number
  brokenAt?: number // Block number kjer je chain prekinjen
  brokenHash?: string
  error?: string
}

// --- Konstante ---
const GENESIS_HASH = '0'.repeat(64) // Genesis block (prvi blok) ima vse ničle
const HASH_ALGORITHM = 'sha256'

// --- 1. DODAJ vnos v chain ---
export async function appendAuditEntry(entry: AuditEntry): Promise<BlockchainEntry> {
  // Pridobi zadnji blok (za previousHash)
  const lastBlock = await db.blockchainAuditEntry.findFirst({
    orderBy: { blockNumber: 'desc' },
    select: { blockNumber: true, currentHash: true },
  })

  const blockNumber = (lastBlock?.blockNumber || 0) + 1
  const previousHash = lastBlock?.currentHash || GENESIS_HASH
  const timestamp = new Date()

  // Izračunaj hash
  const currentHash = calculateHash({
    blockNumber,
    previousHash,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    payload: entry.payload,
    timestamp: timestamp.toISOString(),
  })

  // Podpiši (HMAC z NEXTAUTH_SECRET)
  const signature = signEntry({
    blockNumber,
    previousHash,
    currentHash,
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    timestamp: timestamp.toISOString(),
  })

  // Shrani v DB
  const saved = await db.blockchainAuditEntry.create({
    data: {
      blockNumber,
      previousHash,
      currentHash,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      payload: entry.payload as never,
      signature,
      timestamp,
      minerId: entry.minerId,
    },
  })

  logger.info('BlockchainAudit', `Block #${blockNumber} added: ${entry.entityType}/${entry.action} (${entry.entityId.substring(0, 8)}...)`)

  return {
    ...saved,
    payload: saved.payload,
  } as BlockchainEntry
}

// --- 2. VERIFICIRAJ celotno verigo ---
export async function verifyChain(): Promise<ChainVerificationResult> {
  const blocks = await db.blockchainAuditEntry.findMany({
    orderBy: { blockNumber: 'asc' },
  })

  if (blocks.length === 0) {
    return { valid: true, totalBlocks: 0 }
  }

  let previousHash = GENESIS_HASH

  for (const block of blocks) {
    // Preveri previousHash
    if (block.previousHash !== previousHash) {
      return {
        valid: false,
        totalBlocks: blocks.length,
        brokenAt: block.blockNumber,
        brokenHash: block.currentHash,
        error: `Previous hash mismatch at block #${block.blockNumber}`,
      }
    }

    // Preveri currentHash
    const expectedHash = calculateHash({
      blockNumber: block.blockNumber,
      previousHash: block.previousHash,
      entityType: block.entityType as AuditEntityType,
      entityId: block.entityId,
      action: block.action as AuditAction,
      payload: block.payload as Record<string, unknown>,
      timestamp: block.timestamp.toISOString(),
    })

    if (block.currentHash !== expectedHash) {
      return {
        valid: false,
        totalBlocks: blocks.length,
        brokenAt: block.blockNumber,
        brokenHash: block.currentHash,
        error: `Hash mismatch at block #${block.blockNumber} — possible tampering detected`,
      }
    }

    // Preveri podpis
    const expectedSignature = signEntry({
      blockNumber: block.blockNumber,
      previousHash: block.previousHash,
      currentHash: block.currentHash,
      entityType: block.entityType as AuditEntityType,
      entityId: block.entityId,
      action: block.action as AuditAction,
      timestamp: block.timestamp.toISOString(),
    })

    if (block.signature !== expectedSignature) {
      return {
        valid: false,
        totalBlocks: blocks.length,
        brokenAt: block.blockNumber,
        brokenHash: block.currentHash,
        error: `Signature mismatch at block #${block.blockNumber}`,
      }
    }

    previousHash = block.currentHash
  }

  return {
    valid: true,
    totalBlocks: blocks.length,
  }
}

// --- 3. PRIDOBI chain statistiko ---
export async function getChainStats() {
  const [totalBlocks, lastBlock, byEntityType] = await Promise.all([
    db.blockchainAuditEntry.count(),
    db.blockchainAuditEntry.findFirst({
      orderBy: { blockNumber: 'desc' },
      select: { blockNumber: true, currentHash: true, timestamp: true },
    }),
    db.blockchainAuditEntry.groupBy({
      by: ['entityType'],
      _count: { entityType: true },
    }),
  ])

  return {
    totalBlocks,
    lastBlockNumber: lastBlock?.blockNumber || 0,
    lastBlockHash: lastBlock?.currentHash || GENESIS_HASH,
    lastBlockTime: lastBlock?.timestamp,
    byEntityType: byEntityType.reduce<Record<string, number>>((acc, item) => {
      acc[item.entityType] = item._count.entityType
      return acc
    }, {}),
  }
}

// --- 4. PRIDOBI chain segment (za pregled) ---
export async function getChainSegment(
  fromBlock: number = 1,
  limit: number = 50,
): Promise<BlockchainEntry[]> {
  const blocks = await db.blockchainAuditEntry.findMany({
    where: { blockNumber: { gte: fromBlock } },
    orderBy: { blockNumber: 'asc' },
    take: Math.min(limit, 200),
  })

  return blocks as unknown as BlockchainEntry[]
}

// --- 5. IZVOZI chain (za backup/external audit) ---
export async function exportChain(
  fromBlock?: number,
  toBlock?: number,
): Promise<{
  blocks: BlockchainEntry[]
  verification: ChainVerificationResult
  exportedAt: string
}> {
  const where: Record<string, unknown> = {}
  if (fromBlock) where.blockNumber = { gte: fromBlock }
  if (toBlock) {
    where.blockNumber = { ...(where.blockNumber as Record<string, unknown>), lte: toBlock }
  }

  const blocks = await db.blockchainAuditEntry.findMany({
    where,
    orderBy: { blockNumber: 'asc' },
  })

  const verification = await verifyChain()

  return {
    blocks: blocks as unknown as BlockchainEntry[],
    verification,
    exportedAt: new Date().toISOString(),
  }
}

// --- Helper: izračunaj hash ---
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

// --- Helper: podpiši vnos ---
function signEntry(data: {
  blockNumber: number
  previousHash: string
  currentHash: string
  entityType: string
  entityId: string
  action: string
  timestamp: string
}): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.ENCRYPTION_KEY || 'blockchain-fallback-secret'
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
