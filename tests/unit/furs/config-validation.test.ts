// ============================================
// FURS Config Validation — Unit testi
// Preverja validacijo FURS nastavitev (poslovni prostor, davčna št, cert)
// ============================================
import { describe, it, expect } from 'vitest'
import { validateFursConfig } from '@/lib/furs/helpers/validation'
import type { FursConfig } from '@/lib/furs/types'

const VALID_CONFIG: Partial<FursConfig> = {
  businessId: '12345678',
  taxId: 'SI12345678',
  registerId: 'BLAGAJNA1',
  premisesId: 'PREMISES1',
  certPath: './certs/furs.p12',
  certPassword: 'secret-password',
  environment: 'test',
}

describe('validateFursConfig', () => {
  describe('veljavna konfiguracija', () => {
    it('sprejme popolno, pravilno konfiguracijo', () => {
      const result = validateFursConfig(VALID_CONFIG)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('sprejme konfiguracijo brez premisesId (samo warning)', () => {
      const result = validateFursConfig({ ...VALID_CONFIG, premisesId: undefined })
      expect(result.valid).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings.some(w => w.includes('poslovnega prostora'))).toBe(true)
    })

    it('sprejme konfiguracijo brez certPath (samo warning — simulacija)', () => {
      const result = validateFursConfig({
        ...VALID_CONFIG,
        certPath: undefined,
        certPassword: undefined,
      })
      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.includes('certifikata'))).toBe(true)
    })
  })

  describe('neveljavna businessId', () => {
    it('zavrne manjkajočo matično številko', () => {
      const result = validateFursConfig({ ...VALID_CONFIG, businessId: undefined })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('matična številka podjetja'))).toBe(true)
    })

    it('zavrne matično številko z napačnim formatom (prekratka)', () => {
      const result = validateFursConfig({ ...VALID_CONFIG, businessId: '1234567' })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Matična številka'))).toBe(true)
    })

    it('zavrne matično številko z napačnim formatom (predolga)', () => {
      const result = validateFursConfig({ ...VALID_CONFIG, businessId: '123456789' })
      expect(result.valid).toBe(false)
    })

    it('zavrne matično številko z ne-številkami', () => {
      const result = validateFursConfig({ ...VALID_CONFIG, businessId: '1234567a' })
      expect(result.valid).toBe(false)
    })
  })

  describe('neveljaven taxId', () => {
    it('zavrne manjkajoč ID za DDV', () => {
      const result = validateFursConfig({ ...VALID_CONFIG, taxId: undefined })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('ID za DDV'))).toBe(true)
    })

    it('warning za taxId brez SI prefix-a', () => {
      const result = validateFursConfig({ ...VALID_CONFIG, taxId: '12345678' })
      // Samo warning, ne error — FURS dopušča
      expect(result.warnings.some(w => w.includes('SI'))).toBe(true)
    })

    it('sprejme taxId s pravilnim SI prefix-om in 8 števkami', () => {
      const result = validateFursConfig({ ...VALID_CONFIG, taxId: 'SI12345678' })
      expect(result.valid).toBe(true)
    })
  })

  describe('neveljaven registerId', () => {
    it('zavrne manjkajočo številko blagajne', () => {
      const result = validateFursConfig({ ...VALID_CONFIG, registerId: undefined })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('blagajne'))).toBe(true)
    })

    it('zavrne prazno številko blagajne', () => {
      const result = validateFursConfig({ ...VALID_CONFIG, registerId: '' })
      expect(result.valid).toBe(false)
    })
  })

  describe('certifikat', () => {
    it('warning, če certPath obstaja, certPassword pa manjka', () => {
      const result = validateFursConfig({
        ...VALID_CONFIG,
        certPath: './certs/furs.p12',
        certPassword: undefined,
      })
      expect(result.warnings.some(w => w.includes('geslo certifikata'))).toBe(true)
    })

    it('brez warning-a, če sta tako certPath kot certPassword podana', () => {
      const result = validateFursConfig(VALID_CONFIG)
      expect(result.warnings.some(w => w.includes('certifikata'))).toBe(false)
      expect(result.warnings.some(w => w.includes('geslo'))).toBe(false)
    })
  })

  describe('kumulativne napake', () => {
    it('vrne VSE napake hkrati (ne samo prvo)', () => {
      const result = validateFursConfig({
        businessId: '123',           // napaka 1
        taxId: undefined,             // napaka 2
        registerId: undefined,        // napaka 3
      })
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('prazna konfiguracija', () => {
    it('vrne napake za vsa obvezna polja', () => {
      const result = validateFursConfig({})
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(3) // businessId, taxId, registerId
    })
  })
})
