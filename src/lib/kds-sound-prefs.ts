// ============================================
// KDS ZVOK — PREFERENCA (PERSISTENCA)
// ============================================
// Runda 63: prej je bil zvok samo v ref (use-kds-sound) — utišanje je
// izginilo ob vsakem reloadu (zamenjava izmene, SW update, reconnect).
// Kuhinja utiša zvečer → zjutraj spet piska. Preferenca živi v
// localStorage (ključ kds_sound_enabled), privzeto VKLOPLJEN.
//
// SSR-safe: brez window/storage → privzeta vrednost, nikoli ne mete.
// Testabilna: storage je vbrizgljiv (Pick<Storage, ...>).
// ============================================

export const KDS_SOUND_PREF_KEY = 'kds_sound_enabled'

type MinimalStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

/** Privzeto VKLOPLJEN — pisk so privzeta izkušnja, utišanje je izbira. */
export function loadSoundPref(storage?: MinimalStorage): boolean {
  const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined)
  if (!s) return true
  try {
    const raw = s.getItem(KDS_SOUND_PREF_KEY)
    // samo izrecen '0' utiša; null/pokvarjen zapis → privzeto VKLOPLJENO
    return raw !== '0'
  } catch {
    // zasebni način / blokiran storage → privzeto
    return true
  }
}

export function saveSoundPref(on: boolean, storage?: MinimalStorage): void {
  const s = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined)
  if (!s) return
  try {
    s.setItem(KDS_SOUND_PREF_KEY, on ? '1' : '0')
  } catch {
    // tiho — preferenca ni vredna izjeme
  }
}
