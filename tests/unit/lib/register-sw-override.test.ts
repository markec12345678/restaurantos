/**
 * Testi za PWA QA override v register-sw.ts (QA runda 13)
 *
 * Ozadje: SW se v produkciji vedno registrira, v devu pa je izklopljen
 * (zaščita pred stale Turbopack chunk-i). QA override (?pwa=1 URL param
 * ali localStorage flag) omogoča runtime PWA testiranje v dev načinu.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// URLSearchParams + localStorage sta browser API — mockamo window global
const mockLocalStorage = new Map<string, string>()

function setupWindow(url: string) {
  vi.stubGlobal('window', {
    location: new URL(url),
    localStorage: {
      getItem: (k: string) => mockLocalStorage.get(k) ?? null,
      setItem: (k: string, v: string) => void mockLocalStorage.set(k, v),
      removeItem: (k: string) => void mockLocalStorage.delete(k),
    },
  })
}

describe('isPwaQaOverride', () => {
  // Dynamically imported po nastavitvi window mockinga
  const importHelper = async () => {
    const mod = await import('@/lib/register-sw')
    return mod.isPwaQaOverride
  }

  beforeEach(() => {
    mockLocalStorage.clear()
    // logger se ne sme klicati network/console v testih — pusti privzeto
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('vrne false, kadar window ni definiran (SSR guard)', async () => {
    vi.unstubAllGlobals()
    vi.stubGlobal('window', undefined)
    const isPwaQaOverride = await importHelper()
    expect(isPwaQaOverride()).toBe(false)
  })

  it('vrne false brez override pogojev', async () => {
    setupWindow('http://localhost:3000/')
    const isPwaQaOverride = await importHelper()
    expect(isPwaQaOverride()).toBe(false)
  })

  it('vrne true z URL parametrom ?pwa=1', async () => {
    setupWindow('http://localhost:3000/?pwa=1')
    const isPwaQaOverride = await importHelper()
    expect(isPwaQaOverride()).toBe(true)
  })

  it('vrne false z drugimi URL parametri (?pwa=0, ?drugi=1)', async () => {
    setupWindow('http://localhost:3000/?pwa=0&foo=1')
    const isPwaQaOverride = await importHelper()
    expect(isPwaQaOverride()).toBe(false)
  })

  it('vrne true z localStorage flagom __RESTOS_PWA_DEV__=1', async () => {
    setupWindow('http://localhost:3000/')
    mockLocalStorage.set('__RESTOS_PWA_DEV__', '1')
    const isPwaQaOverride = await importHelper()
    expect(isPwaQaOverride()).toBe(true)
  })

  it('localStorage flag z drugo vrednostjo ne aktivira override-a', async () => {
    setupWindow('http://localhost:3000/')
    mockLocalStorage.set('__RESTOS_PWA_DEV__', 'true') // mora biti točno '1'
    const isPwaQaOverride = await importHelper()
    expect(isPwaQaOverride()).toBe(false)
  })

  it('URL param ima prednost in deluje tudi brez localStorage', async () => {
    setupWindow('http://localhost:3000/?pwa=1&module=orders')
    const isPwaQaOverride = await importHelper()
    expect(isPwaQaOverride()).toBe(true)
  })

  it('ne crasha, če localStorage meče napako (try/catch guard)', async () => {
    vi.stubGlobal('window', {
      location: new URL('http://localhost:3000/'),
      localStorage: {
        getItem: () => {
          throw new Error('SecurityError: denied')
        },
        setItem: () => {},
        removeItem: () => {},
      },
    })
    const isPwaQaOverride = await importHelper()
    expect(isPwaQaOverride()).toBe(false)
  })
})
