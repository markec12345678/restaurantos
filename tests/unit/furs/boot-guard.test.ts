// ============================================
// FURS BOOT GUARD — testi (FURS AUDIT 2026-09-09)
// ============================================
// Uporabniška zahteva (točka 4): "V produkciji mora aplikacija zavrniti
// zagon, če je vključen simulation mode."
// ============================================

import { describe, it, expect, afterEach, vi } from 'vitest'
import { checkFursBootReadiness, assertFursBootReadiness } from '@/lib/furs/boot-guard'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('FURS boot guard — checkFursBootReadiness', () => {
  it('v razvoju (NODE_ENV != production) je vedno OK', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('FURS_ALLOW_SIMULATION', 'true') // celo sim. je OK v dev
    const result = checkFursBootReadiness()
    expect(result.ok).toBe(true)
    expect(result.check).toBe('none')
  })

  it('v produkciji BREZ simulation mode → OK', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('FURS_ALLOW_SIMULATION', 'false') // izrecno izklopljena sim.
    const result = checkFursBootReadiness()
    expect(result.ok).toBe(true)
  })

  it('v produkciji z FURS_ALLOW_SIMULATION=true → ZAVRNI', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('FURS_ALLOW_SIMULATION', 'true')
    const result = checkFursBootReadiness()
    expect(result.ok).toBe(false)
    expect(result.check).toBe('simulation-in-production')
    expect(result.reason).toContain('FURS_ALLOW_SIMULATION')
  })

  it('v produkciji z FURS_ALLOW_SIMULATION=false → OK', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('FURS_ALLOW_SIMULATION', 'false')
    const result = checkFursBootReadiness()
    expect(result.ok).toBe(true)
  })

  it('endpoint varovalka: FURS_URLS.production obstaja (https)', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('FURS_ALLOW_SIMULATION', 'false')
    const result = checkFursBootReadiness()
    // endpoint je hardkodiran — preveri, da check minec (ne missing-endpoint)
    expect(result.check).not.toBe('missing-endpoint')
  })
})

describe('FURS boot guard — assertFursBootReadiness (throw variant)', () => {
  it('ne vrže napake, ko je konfiguracija varna', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('FURS_ALLOW_SIMULATION', 'false')
    expect(() => assertFursBootReadiness()).not.toThrow()
  })

  it('vrže FURS BOOT GUARD napako v produkciji s sim. načinom', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('FURS_ALLOW_SIMULATION', 'true')
    expect(() => assertFursBootReadiness()).toThrow(/FURS BOOT GUARD/)
    expect(() => assertFursBootReadiness()).toThrow(/Zagon ZAVRNJEN/)
  })
})
