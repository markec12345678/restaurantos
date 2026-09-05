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
// ⚠️ P0-C3B KNOWN LIMITATION (TODO P0-C4):
// API ključi so trenutno shranjeni v RestaurantSettings.apiKeys (JSON array) —
// to je GLOBAL keystore brez tenant isolation. V multi-tenant SaaS setupu:
//   - Tenant A cron key lahko dostopa do Tenant B podatkov
//   - Scopes so globalne, ne per-tenant
// Pravilna rešitev (P0-C4): Nova tabela `ApiKey` z `subscriptionId` relacijo:
//   model ApiKey {
//     id              String   @id @default(cuid())
//     subscriptionId  String
//     name            String
//     keyPrefix       String
//     keyHash         String   @unique
//     scopes          String   @default("[]")  // JSON
//     rateLimit       Int      @default(60)
//     isActive        Boolean  @default(true)
//     ...
//   }
// verifyApiKey() naj vrne tudi tenant context (subscriptionId), da klicatelj
// lahko scope-a vse nadaljne query-je.
// Dokler ni migrirano: to deluje samo za single-tenant deploy.
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

// 1. GENERIRAJ nov API key
export async function createApiKey(input: CreateApiKeyInput): Promise<CreatedApiKey> {
  // Generiraj random key
  const randomBytes = crypto.randomBytes(KEY_LENGTH)
  const plainKey = KEY_PREFIX + randomBytes.toString('hex')

  // Hash za shranjevanje
  const keyHash = hashKey(plainKey)
  const keyPrefix = plainKey.substring(0, 12) // "posr_xxxxxxxx"

  // Shrani v DB (uporabimo RestaurantSettings kot key-value store)
  const existing = await db.restaurantSettings.findFirst()
  if (!existing) {
    throw new Error('RestaurantSettings ne obstaja — kreirajte najprej')
  }

  const apiKeysJson = (existing as { apiKeys?: string }).apiKeys || '[]'
  const apiKeys: ApiKey[] = JSON.parse(apiKeysJson)

  const newKey: ApiKey = {
    id: crypto.randomUUID(),
    name: input.name,
    keyPrefix,
    keyHash,
    scopes: input.scopes,
    rateLimit: input.rateLimit || 60, // default 60 req/min
    isActive: true,
    createdAt: new Date(),
    expiresAt: input.expiresAt,
    createdBy: input.createdBy,
  }

  apiKeys.push(newKey)

  await db.restaurantSettings.update({
    where: { id: existing.id },
    data: { apiKeys: JSON.stringify(apiKeys) } as never,
  })

  logger.info('ApiSecurity', `Created API key ${newKey.name} (${keyPrefix}...)`)

  return { ...newKey, plainKey }
}

// 2. VERIFICIRAJ API key iz request headerja
export async function verifyApiKey(authHeader: string | null): Promise<{
  valid: boolean
  apiKey?: ApiKey
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

  // Pridobi vse ključe
  const settings = await db.restaurantSettings.findFirst()
  if (!settings) {
    return { valid: false, error: 'Nastavitve ne obstajajo' }
  }

  const apiKeysJson = (settings as { apiKeys?: string }).apiKeys || '[]'
  const apiKeys: ApiKey[] = JSON.parse(apiKeysJson)

  // Najdi ujemajoči ključ
  const apiKey = apiKeys.find((k) => k.keyHash === keyHash)
  if (!apiKey) {
    return { valid: false, error: 'Neveljaven API ključ' }
  }

  // Preveri status
  if (!apiKey.isActive) {
    return { valid: false, error: 'API ključ je deaktiviran' }
  }

  // Preveri potek
  if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
    return { valid: false, error: 'API ključ je potekel' }
  }

  // Posodobi lastUsedAt (non-blocking)
  apiKey.lastUsedAt = new Date()
  await db.restaurantSettings.update({
    where: { id: settings.id },
    data: { apiKeys: JSON.stringify(apiKeys) } as never,
  }).catch(() => {
    // Non-critical
  })

  return { valid: true, apiKey }
}

// 3. PREVERI ali key ima določen scope
export function hasScope(apiKey: ApiKey, scope: string): boolean {
  if (apiKey.scopes.includes('admin')) return true
  return apiKey.scopes.includes(scope)
}

// 4. LIST vseh ključev (brez hash-a)
export async function listApiKeys(): Promise<Array<Omit<ApiKey, 'keyHash'>>> {
  const settings = await db.restaurantSettings.findFirst()
  if (!settings) return []

  const apiKeysJson = (settings as { apiKeys?: string }).apiKeys || '[]'
  const apiKeys: ApiKey[] = JSON.parse(apiKeysJson)

  // Odstrani keyHash iz response-a
  return apiKeys.map(({ keyHash: _keyHash, ...rest }) => rest)
}

// 5. REVOKE API key
export async function revokeApiKey(keyId: string): Promise<boolean> {
  const settings = await db.restaurantSettings.findFirst()
  if (!settings) return false

  const apiKeysJson = (settings as { apiKeys?: string }).apiKeys || '[]'
  const apiKeys: ApiKey[] = JSON.parse(apiKeysJson)

  const key = apiKeys.find((k) => k.id === keyId)
  if (!key) return false

  key.isActive = false

  await db.restaurantSettings.update({
    where: { id: settings.id },
    data: { apiKeys: JSON.stringify(apiKeys) } as never,
  })

  logger.info('ApiSecurity', `Revoked API key ${key.name} (${key.keyPrefix}...)`)
  return true
}

// 6. DELETE API key (popolnoma)
export async function deleteApiKey(keyId: string): Promise<boolean> {
  const settings = await db.restaurantSettings.findFirst()
  if (!settings) return false

  const apiKeysJson = (settings as { apiKeys?: string }).apiKeys || '[]'
  const apiKeys: ApiKey[] = JSON.parse(apiKeysJson)

  const filtered = apiKeys.filter((k) => k.id !== keyId)
  if (filtered.length === apiKeys.length) return false

  await db.restaurantSettings.update({
    where: { id: settings.id },
    data: { apiKeys: JSON.stringify(filtered) } as never,
  })

  return true
}

// 7. ROTATE API key (revoke stari + kreiraj novi z istimi scopes)
export async function rotateApiKey(keyId: string): Promise<CreatedApiKey | null> {
  const settings = await db.restaurantSettings.findFirst()
  if (!settings) return null

  const apiKeysJson = (settings as { apiKeys?: string }).apiKeys || '[]'
  const apiKeys: ApiKey[] = JSON.parse(apiKeysJson)

  const oldKey = apiKeys.find((k) => k.id === keyId)
  if (!oldKey) return null

  // Kreiraj novi z istimi nastavitvami
  const newKey = await createApiKey({
    name: oldKey.name + ' (rotated)',
    scopes: oldKey.scopes,
    rateLimit: oldKey.rateLimit,
    expiresAt: oldKey.expiresAt,
    createdBy: oldKey.createdBy,
  })

  // Revoke stari
  await revokeApiKey(keyId)

  return newKey
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
