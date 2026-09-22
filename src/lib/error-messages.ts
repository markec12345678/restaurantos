// ============================================
// ERROR MESSAGES — Preslikava znanih angleških napak v slovenščino
// ============================================
// P2-UX FIX (prevodi vseh error messageov): brskalnik/HTTP vrže angleške
// napake ("Failed to fetch" itd.), ki so se prek toast.error(err.message)
// prikazale neposredno uporabniku. Backend API-ji vračajo Slovenščino —
// te sporočila pustimo nespremenjena; preslikamo samo znane tehnične vzorce.

const ERROR_TRANSLATIONS: [RegExp, string][] = [
  [/^failed to fetch$/i, 'Ni povezave s strežnikom — preverite omrežje'],
  [/failed to fetch/i, 'Ni povezave s strežnikom — preverite omrežje'],
  [/network ?error|network request failed/i, 'Napaka omrežja — poskusite znova'],
  [/load failed/i, 'Nalaganje ni uspelo — preverite povezavo'],
  [/aborterror|aborted/i, 'Zahteva je bila prekinjena'],
  [/timeout|timed out|deadline ?exceeded/i, 'Zahteva je potekla — poskusite znova'],
  [/order not found/i, 'Naročilo ni najdeno'],
  [/not found/i, 'Zapis ni najden'],
  [/unauthorized|401/i, 'Nimate pooblastil za to dejanje — prijavite se znova'],
  [/forbidden|403/i, 'Nimate dovoljenja za to dejanje'],
  [/internal server error|500/i, 'Napaka na strežniku — poskusite kasneje'],
  [/bad request|400/i, 'Neveljavna zahteva'],
  [/json/i, 'Neveljaven odgovor strežnika'],
]

/**
 * Vrni slovensko sporočilo napake za prikaz uporabniku.
 * - Znane angleške/tehnične vzorce preslika v slovenščino.
 * - Slovenska sporočila (iz naših API-jev) pusti nespremenjena.
 * - Neznano/prazno → fallback.
 */
export function errorSl(err: unknown, fallback = 'Prišlo je do napake'): string {
  let msg = ''
  if (err instanceof Error) msg = err.message ?? ''
  else if (typeof err === 'string') msg = err
  else if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message
    if (typeof m === 'string') msg = m
  }
  if (!msg) return fallback
  for (const [pattern, sl] of ERROR_TRANSLATIONS) {
    if (pattern.test(msg)) return sl
  }
  // Neznano sporočilo — verjetno Slovenščina z backend-a; podaj naprej.
  // Nikoli ne izpostavi stack-a ali tehničnih podrobnosti (err.stack NE).
  if (msg.length > 300) return fallback
  return msg
}
