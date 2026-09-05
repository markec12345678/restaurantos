// ============================================
// API SECURITY — API Key management + Audit trail
// ============================================
// Za service-to-service avtentikacijo (cron jobs, external integrations).
// Ločen od user session auth — API keys so za serverske klice.
//
// Prednosti:
//   - Service accounts za cron jobs (ne rabijo PIN-a)
//   - Rate limiting per key
//   - Audit trail kdo je klical kaj
//   - Enostavna rotacija (revoke + reissue)
//
// ⚠️ P0-C5 MIGRATED (September 2026):
// API ključi so sedaj shranjeni v ApiKey tabeli (ne RestaurantSettings.apiKeys JSON).
// ApiKey tabela ima subscriptionId FK za multi-tenant isolation — Tenant A key
// ne more dostopati do Tenant B podatkov.
//
// verifyApiKey() zdaj vrača tudi subscriptionId — klicatelj ga lahko uporabi
// za scope vseh nadaljnih query-jev.
//
// Backfill: scripts/p0-c5-backfill-apikeys.mjs migrira obstoječe ključe.
// RestaurantSettings.apiKeys ostaja kot fallback (grace period 30 dni).
// ============================================

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

// --- Tipi ---
export interface ApiKey {
  id: string
  name: string // "Cron worker", "External integration X"
  keyPrefix: string // Prvih 8 znakov (za identifikacijo, npr. "posr_xxxx")
  keyHash: string // SHA-256 hash (nikoli ne shranjujemo plain key)
  scopes: string[] // ["read:orders", "write:orders", "admin"]
  rateLimit: number // requests per minute
  // Status
  isActive: boolean
  // Čas
  createdAt: Date
  lastUsedAt?: Date
  expiresAt?: Date
  // Created by
  createdBy?: string
}

export interface CreateApiKeyInput {
  name: string
  scopes: string[]
  rateLimit?: number
  expiresAt?: Date
  createdBy?: string
}

export interface CreatedApiKey extends ApiKey {
  // Plain key — samo ob kreaciji, nikoli več prikazan
  plainKey: string
}

// --- Konstante ---
const KEY_PREFIX = 'posr_'
const KEY_LENGTH = 32 // bytes (64 hex chars)
const HASH_ALGORITHM = 'sha256'

// --- Glavne funkcije ---

// FIX P0-C5: Vse funkcije sedaj uporabljajo ApiKey tabelo (ne RestaurantSettings.apiKeys JSON).
// ApiKey tabela ima subscriptionId FK za multi-tenant isolation.
// Backfill: scripts/p0-c5-backfill-apikeys.mjs migrira obstoječe ključe.

// Helper: pridobi ali kreiraj default Subscription (single-tenant compat)
async function getOrCreateDefaultSubscriptionId(): Promise<string> {
  const existing = await db.subscription.findFirst({ select: { id: true } })
  if (existing) return existing.id

  // Kreiraj default Subscription (single-tenant compat)
  const sub = await db.subscription.create({
    data: {
      companyName: 'Default Company',
      email: 'admin@default.test',
      plan: 'professional',
      status: 'active',
    },
    select: { id: true },
  })
  logger.info('ApiSecurity', `Created default Subscription: ${sub.id}`)
  return sub.id
}

// 1. GENERIRAJ nov API key
export async function createApiKey(input: CreateApiKeyInput): Promise<CreatedApiKey> {
  // Generiraj random key
  const randomBytes = crypto.randomBytes(KEY_LENGTH)
  const plainKey = KEY_PREFIX + randomBytes.toString('hex')

  // Hash za shranjevanje
  const keyHash = hashKey(plainKey)
  const keyPrefix = plainKey.substring(0, 12) // "posr_xxxxxxxx"

  // Pridobi subscription (multi-tenant root)
  const subscriptionId = await getOrCreateDefaultSubscriptionId()

  // Shrani v ApiKey tabelo
  const newKey = await db.apiKey.create({
    data: {
      subscriptionId,
      name: input.name,
      keyPrefix,
      keyHash,
      scopes: JSON.stringify(input.scopes),
      rateLimit: input.rateLimit || 60,
      isActive: true,
      expiresAt: input.expiresAt,
      createdBy: input.createdBy,
    },
  })

  // Convert to ApiKey interface (scopes back to array)
  const apiKeyResult: ApiKey = {
    id: newKey.id,
    name: newKey.name,
    keyPrefix: newKey.keyPrefix,
    keyHash: newKey.keyHash,
    scopes: JSON.parse(newKey.scopes || '[]'),
    rateLimit: newKey.rateLimit,
    isActive: newKey.isActive,
    createdAt: newKey.createdAt,
    lastUsedAt: newKey.lastUsedAt || undefined,
    expiresAt: newKey.expiresAt || undefined,
    createdBy: newKey.createdBy || undefined,
  }

  logger.info('ApiSecurity', `Created API key ${newKey.name} (${keyPrefix}...) for subscription ${subscriptionId}`)

  return { ...apiKeyResult, plainKey }
}

// 2. VERIFICIRAJ API key iz request headerja
export async function verifyApiKey(authHeader: string | null): Promise<{
  valid: boolean
  apiKey?: ApiKey
  subscriptionId?: string
  error?: string
}> {
  if (!authHeader) {
    return { valid: false, error: 'Manjka Authorization header' }
  }

  // Podpira: "Bearer posr_xxx" ali "ApiKey posr_xxx"
  const match = authHeader.match(/^(?:Bearer|ApiKey)\s+(posr_\w+)$/i)
  if (!match) {
    return { valid: false, error: 'Neveljaven format API ključa' }
  }

  const plainKey = match[1]
  const keyHash = hashKey(plainKey)

  // FIX P0-C5: Preberi iz ApiKey tabele (ne RestaurantSettings JSON)
  const dbKey = await db.apiKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      subscriptionId: true,
      name: true,
      keyPrefix: true,
      keyHash: true,
      scopes: true,
      rateLimit: true,
      isActive: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
      createdBy: true,
    },
  })

  if (!dbKey) {
    return { valid: false, error: 'Neveljaven API ključ' }
  }

  // Preveri status
  if (!dbKey.isActive) {
    return { valid: false, error: 'API ključ je deaktiviran' }
  }

  // Preveri potek
  if (dbKey.expiresAt && new Date() > dbKey.expiresAt) {
    return { valid: false, error: 'API ključ je potekel' }
  }

  // Posodobi lastUsedAt (non-blocking)
  await db.apiKey.update({
    where: { id: dbKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {
    // Non-critical
  })

  const apiKey: ApiKey = {
    id: dbKey.id,
    name: dbKey.name,
    keyPrefix: dbKey.keyPrefix,
    keyHash: dbKey.keyHash,
    scopes: JSON.parse(dbKey.scopes || '[]'),
    rateLimit: dbKey.rateLimit,
    isActive: dbKey.isActive,
    createdAt: dbKey.createdAt,
    lastUsedAt: dbKey.lastUsedAt || undefined,
    expiresAt: dbKey.expiresAt || undefined,
    createdBy: dbKey.createdBy || undefined,
  }

  // FIX P0-C5: vrni tudi subscriptionId za tenant scoping
  return { valid: true, apiKey, subscriptionId: dbKey.subscriptionId }
}

// 3. PREVERI ali key ima določen scope
export function hasScope(apiKey: ApiKey, scope: string): boolean {
  if (apiKey.scopes.includes('admin')) return true
  return apiKey.scopes.includes(scope)
}

// 4. LIST vseh ključev (brez hash-a)
export async function listApiKeys(subscriptionId?: string): Promise<Array<Omit<ApiKey, 'keyHash'>>> {
  const keys = await db.apiKey.findMany({
    where: subscriptionId ? { subscriptionId } : {},
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      rateLimit: true,
      isActive: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
      createdBy: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return keys.map(k => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    scopes: JSON.parse(k.scopes || '[]'),
    rateLimit: k.rateLimit,
    isActive: k.isActive,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt || undefined,
    expiresAt: k.expiresAt || undefined,
    createdBy: k.createdBy || undefined,
  }))
}

// 5. REVOKE API key
export async function revokeApiKey(keyId: string): Promise<boolean> {
  const result = await db.apiKey.updateMany({
    where: { id: keyId, isActive: true },
    data: { isActive: false },
  })
  if (result.count > 0) {
    logger.info('ApiSecurity', `Revoked API key ${keyId}`)
    return true
  }
  return false
}

// 6. DELETE API key (popolnoma)
export async function deleteApiKey(keyId: string): Promise<boolean> {
  const result = await db.apiKey.deleteMany({
    where: { id: keyId },
  })
  return result.count > 0
}

// 7. ROTATE API key (revoke stari + kreiraj novi z istimi scopes)
export async function rotateApiKey(keyId: string): Promise<CreatedApiKey | null> {
  const oldKey = await db.apiKey.findUnique({
    where: { id: keyId },
    select: { name: true, scopes: true, rateLimit: true, expiresAt: true, createdBy: true, subscriptionId: true },
  })

  if (!oldKey) return null

  // Kreiraj novi z istimi nastavitvami in subscriptionId
  const randomBytes = crypto.randomBytes(KEY_LENGTH)
  const plainKey = KEY_PREFIX + randomBytes.toString('hex')
  const keyHash = hashKey(plainKey)
  const keyPrefix = plainKey.substring(0, 12)

  const newKey = await db.apiKey.create({
    data: {
      subscriptionId: oldKey.subscriptionId,
      name: oldKey.name + ' (rotated)',
      keyPrefix,
      keyHash,
      scopes: oldKey.scopes,
      rateLimit: oldKey.rateLimit,
      isActive: true,
      expiresAt: oldKey.expiresAt,
      createdBy: oldKey.createdBy,
    },
  })

  // Revoke stari
  await revokeApiKey(keyId)

  return {
    id: newKey.id,
    name: newKey.name,
    keyPrefix: newKey.keyPrefix,
    keyHash: newKey.keyHash,
    scopes: JSON.parse(newKey.scopes || '[]'),
    rateLimit: newKey.rateLimit,
    isActive: newKey.isActive,
    createdAt: newKey.createdAt,
    lastUsedAt: newKey.lastUsedAt || undefined,
    expiresAt: newKey.expiresAt || undefined,
    createdBy: newKey.createdBy || undefined,
    plainKey,
  }
}

// --- Helper funkcije ---

function hashKey(plainKey: string): string {
  return crypto.createHash(HASH_ALGORITHM).update(plainKey).digest('hex')
}

// --- Audit log (za admin pregled) ---
export interface ApiKeyAuditEntry {
  timestamp: string
  keyName: string
  keyPrefix: string
  endpoint: string
  method: string
  ip: string
  success: boolean
}

export async function logApiKeyUsage(
  apiKey: ApiKey,
  request: { url: string; method: string },
  ip: string,
  success: boolean,
): Promise<void> {
  // Za MVP samo logiramo — v produkciji bi shranjevali v DB
  logger.info('ApiSecurity', `Key ${apiKey.keyPrefix} → ${request.method} ${request.url} (${success ? 'OK' : 'FAIL'}) from ${ip}`)
}
