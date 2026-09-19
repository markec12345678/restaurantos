import { describe, expect, it } from 'vitest'
import {
  loadSoundPref,
  saveSoundPref,
  KDS_SOUND_PREF_KEY,
} from '@/lib/kds-sound-prefs'

/** In-memory storage dvojček (isti vzorec kot ostali pref testi). */
function makeStorage(initial: Record<string, string> = {}): {
  store: Map<string, string>
  getItem: (k: string) => string | null
  setItem: (k: string, v: string) => void
} {
  const store = new Map(Object.entries(initial))
  return {
    store,
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, v),
  }
}

// Runda 63: KDS zvok preferenca — utišanje preživi reload (prej ref-only)

describe('kds-sound-prefs', () => {
  it('brez storage-a (SSR) → privzeto vklopljen', () => {
    expect(loadSoundPref(undefined)).toBe(true)
  })

  it('shranjena vrednost: "1" → on, "0" → off, brez ključa → on', () => {
    expect(loadSoundPref(makeStorage({ [KDS_SOUND_PREF_KEY]: '1' }))).toBe(true)
    expect(loadSoundPref(makeStorage({ [KDS_SOUND_PREF_KEY]: '0' }))).toBe(false)
    expect(loadSoundPref(makeStorage())).toBe(true)
  })

  it('pokvarjen zapis → privzeto vklopljen (ne mete)', () => {
    expect(loadSoundPref(makeStorage({ [KDS_SOUND_PREF_KEY]: 'garbage' }))).toBe(true)
  })

  it('saveSoundPref zapiše "1"/"0"', () => {
    const s = makeStorage()
    saveSoundPref(false, s)
    expect(s.store.get(KDS_SOUND_PREF_KEY)).toBe('0')
    saveSoundPref(true, s)
    expect(s.store.get(KDS_SOUND_PREF_KEY)).toBe('1')
  })
})
