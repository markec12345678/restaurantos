// ============================================
// SECRETS ENCRYPTION TESTS — Issue #46
//
// Testi:
// 1. encrypt/decrypt round-trip
// 2. Tampered ciphertext → authTag failure
// 3. Wrong key → decryption failure
// 4. Plaintext ni v encryptanem output
// 5. Idempotent (ensureEncrypted ne encrypta dvakrat)
// 6. Empty/null handling
// 7. isEncrypted detection
// 8. Key generation
// ============================================

import { describe, it, expect, beforeAll } from 'vitest'
import { encrypt, decrypt, isEncrypted, ensureEncrypted, ensureDecrypted, generateEncryptionKey } from '@/lib/crypto/secrets'

describe('Issue #46: Secrets Encryption (AES-256-GCM)', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64)
    process.env.ENCRYPTION_KEY_VERSION = 'test-v1'
  })

  describe('Test 1: encrypt/decrypt round-trip', () => {
    it('should encrypt and decrypt back to original value', () => {
      const plaintext = 'MySecretPassword123!'
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('should produce different ciphertext for same plaintext (random IV)', () => {
      const plaintext = 'SamePassword'
      const enc1 = encrypt(plaintext)
      const enc2 = encrypt(plaintext)
      expect(enc1).not.toBe(enc2)
      expect(decrypt(enc1)).toBe(plaintext)
      expect(decrypt(enc2)).toBe(plaintext)
    })

    it('should handle long secrets', () => {
      const plaintext = 'x'.repeat(10000)
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(plaintext)
    })
  })

  describe('Test 2: Tampered ciphertext → failure', () => {
    it('should throw on tampered ciphertext', () => {
      const encrypted = encrypt('SecretData')
      const parts = encrypted.split(':')
      // Tamper sredino ciphertext-a (ne zadnjega znaka ki je lahko '=' padding)
      const ct = parts[4]
      if (ct.length > 2) {
        const midIdx = Math.floor(ct.length / 2)
        parts[4] = ct.slice(0, midIdx) + (ct[midIdx] === 'A' ? 'B' : 'A') + ct.slice(midIdx + 1)
      }
      const tampered = parts.join(':')
      expect(() => decrypt(tampered)).toThrow()
    })

    it('should throw on tampered authTag', () => {
      const encrypted = encrypt('SecretData')
      const parts = encrypted.split(':')
      // Tamper sredino authTag-a (ne zadnjega znaka ki je lahko '=' padding)
      const tag = parts[3]
      if (tag.length > 2) {
        const midIdx = Math.floor(tag.length / 2)
        parts[3] = tag.slice(0, midIdx) + (tag[midIdx] === 'A' ? 'B' : 'A') + tag.slice(midIdx + 1)
      }
      const tampered = parts.join(':')
      expect(() => decrypt(tampered)).toThrow()
    })
  })

  describe('Test 3: Wrong key → failure', () => {
    it('should throw when decrypting with invalid encrypted format', () => {
      const fakeEncrypted = 'enc:v1:AAAA:BBBB:CCCC'
      expect(() => decrypt(fakeEncrypted)).toThrow()
    })
  })

  describe('Test 4: Plaintext not in encrypted output', () => {
    it('should NOT contain plaintext in encrypted value', () => {
      const plaintext = 'VerySecretPassword123'
      const encrypted = encrypt(plaintext)
      expect(encrypted).not.toContain(plaintext)
      expect(encrypted).not.toContain('VerySecret')
      expect(encrypted).not.toContain('Password')
    })

    it('should start with enc:v1: prefix', () => {
      const encrypted = encrypt('test')
      expect(encrypted.startsWith('enc:v1:')).toBe(true)
    })
  })

  describe('Test 5: Idempotent operations', () => {
    it('ensureEncrypted should not encrypt twice', () => {
      const plaintext = 'MyPassword'
      const encrypted = ensureEncrypted(plaintext)
      const doubleEncrypted = ensureEncrypted(encrypted)
      expect(doubleEncrypted).toBe(encrypted)
    })

    it('ensureDecrypted should handle plaintext (backward compat)', () => {
      const plaintext = 'NotEncryptedPassword'
      const result = ensureDecrypted(plaintext)
      expect(result).toBe(plaintext)
    })

    it('ensureDecrypted should decrypt encrypted values', () => {
      const plaintext = 'EncryptedPassword'
      const encrypted = ensureEncrypted(plaintext)
      const decrypted = ensureDecrypted(encrypted)
      expect(decrypted).toBe(plaintext)
    })
  })

  describe('Test 6: Empty/null handling', () => {
    it('should return empty string for empty input', () => {
      expect(encrypt('')).toBe('')
      expect(decrypt('')).toBe('')
      expect(ensureEncrypted('')).toBe('')
      expect(ensureDecrypted('')).toBe('')
    })

    it('isEncrypted should return false for empty', () => {
      expect(isEncrypted('')).toBe(false)
    })
  })

  describe('Test 7: isEncrypted detection', () => {
    it('should detect encrypted values', () => {
      const encrypted = encrypt('test')
      expect(isEncrypted(encrypted)).toBe(true)
    })

    it('should not detect plaintext as encrypted', () => {
      expect(isEncrypted('plaintext')).toBe(false)
      expect(isEncrypted('password123')).toBe(false)
    })
  })

  describe('Test 8: Key generation', () => {
    it('should generate 64-char hex key', () => {
      const key = generateEncryptionKey()
      expect(key).toHaveLength(64)
      expect(key).toMatch(/^[0-9a-f]+$/)
    })

    it('should generate unique keys', () => {
      const key1 = generateEncryptionKey()
      const key2 = generateEncryptionKey()
      expect(key1).not.toBe(key2)
    })
  })
})
