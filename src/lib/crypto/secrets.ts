// ============================================
// SECRETS — Central encryption/decryption utility
//
// Issue #46: Secrets stored in DB without encryption-at-rest
//
// Implementacija: AES-256-GCM
// - vsak encryption generira unikaten IV (nonce)
// - authTag preprečuje tampering (integrity)
// - ciphertext format: "enc:v1:{base64(IV)}:{base64(authTag)}:{base64(ciphertext)}"
// - ENCRYPTION_KEY iz environment variable (32 bytes = 256 bits)
// - ENCRYPTION_KEY_VERSION za key rotation support
//
// Varnostne garancije:
// - Napačen key → decrypt vrže napako (ne vrne plaintext)
// - Tampered ciphertext → authTag verification fail
// - Plaintext nikoli v logih
// - Plaintext nikoli v API response
// ============================================

import crypto from 'crypto'

// ============================================
// KONSTANTE
// ============================================

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // GCM standard: 12 bytes (96 bits)
const AUTH_TAG_LENGTH = 16 // GCM standard: 16 bytes (128 bits)
const KEY_LENGTH = 32 // 256 bits
const PREFIX = 'enc:v1:' // Format prefix za identifikacijo encrypted vrednosti
const ENCODING = 'base64' as const

// ============================================
// KEY MANAGEMENT
// ============================================

let cachedKey: Buffer | null = null
let cachedKeyVersion: string = ''

/**
 * Pridobi encryption key iz environment variable.
 *
 * @returns 32-byte Buffer (AES-256)
 * @throws Error če ENCRYPTION_KEY ni nastavljen ali je pren kratke
 */
function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey

  const keyEnv = process.env.ENCRYPTION_KEY
  if (!keyEnv) {
    // V dev/seed okolju brez ENCRYPTION_KEY: generiraj ephemeral key (ni persisten!)
    if (process.env.NODE_ENV === 'development' && !process.env.REDIS_URL) {
      console.warn('[crypto] ⚠️ ENCRYPTION_KEY not set — using ephemeral key (dev only, NOT for production)')
      cachedKey = crypto.randomBytes(KEY_LENGTH)
      cachedKeyVersion = 'ephemeral-dev'
      return cachedKey
    }
    throw new Error('[crypto] ENCRYPTION_KEY not set — required for production. Set a 32-byte hex string in environment.')
  }

  let key: Buffer
  if (keyEnv.length === 64 && /^[0-9a-f]+$/i.test(keyEnv)) {
    key = Buffer.from(keyEnv, 'hex')
  } else if (keyEnv.length === 44) {
    key = Buffer.from(keyEnv, 'base64')
  } else {
    key = crypto.createHash('sha256').update(keyEnv).digest()
  }

  if (key.length !== KEY_LENGTH) {
    throw new Error(`[crypto] ENCRYPTION_KEY must be ${KEY_LENGTH} bytes, got ${key.length}`)
  }

  cachedKey = key
  cachedKeyVersion = process.env.ENCRYPTION_KEY_VERSION || 'v1'
  return cachedKey
}

/**
 * Vrni trenutno verzijo encryption key-a (za key rotation support).
 */
export function getEncryptionKeyVersion(): string {
  getEncryptionKey()
  return cachedKeyVersion
}

// ============================================
// ENCRYPT / DECRYPT
// ============================================

/**
 * Encrypta plaintext string z AES-256-GCM.
 *
 * @param plaintext - tekst za encryptanje
 * @returns format: "enc:v1:{base64(IV)}:{base64(authTag)}:{base64(ciphertext)}"
 */
export function encrypt(plaintext: string): string {
  if (!plaintext || plaintext === '') return ''
  if (isEncrypted(plaintext)) return plaintext

  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return [
    PREFIX,
    iv.toString(ENCODING),
    authTag.toString(ENCODING),
    ciphertext.toString(ENCODING),
  ].join(':')
}

/**
 * Decrypta AES-256-GCM encrypted string.
 *
 * @param encryptedValue - format: "enc:v1:{base64(IV)}:{base64(authTag)}:{base64(ciphertext)}"
 * @returns plaintext string
 * @throws Error če je value tampered ali če je key napačen
 */
export function decrypt(encryptedValue: string): string {
  if (!encryptedValue || encryptedValue === '') return ''
  if (!isEncrypted(encryptedValue)) return encryptedValue

  const key = getEncryptionKey()

  const parts = encryptedValue.split(':')
  if (parts.length !== 5 || parts[0] !== 'enc' || parts[1] !== 'v1') {
    throw new Error('[crypto] Invalid encrypted value format')
  }

  const iv = Buffer.from(parts[2], ENCODING)
  const authTag = Buffer.from(parts[3], ENCODING)
  const ciphertext = Buffer.from(parts[4], ENCODING)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })
  decipher.setAuthTag(authTag)

  try {
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ])
    return plaintext.toString('utf8')
  } catch {
    throw new Error('[crypto] Decryption failed: tampered ciphertext or wrong key')
  }
}

/**
 * Preveri ali je vrednost že encryptana.
 */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') return false
  return value.startsWith(PREFIX)
}

/**
 * Encrypta vrednost samo če še ni encryptana (idempotent).
 * Uporabno za write path: vedno pokliči ensureEncrypted() pred shranjevanjem.
 */
export function ensureEncrypted(value: string): string {
  if (!value || value === '') return ''
  if (isEncrypted(value)) return value
  return encrypt(value)
}

/**
 * Decrypta vrednost samo če je encryptana (idempotent).
 * Uporabno za read path: vedno pokliči ensureDecrypted() po branju iz DB.
 */
export function ensureDecrypted(value: string): string {
  if (!value || value === '') return ''
  if (!isEncrypted(value)) return value
  return decrypt(value)
}

/**
 * Generiraj novi 32-byte encryption key (hex format).
 * Uporabi za setup: `ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")`
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex')
}
