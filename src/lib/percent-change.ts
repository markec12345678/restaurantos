// ============================================
// PERCENT CHANGE — čista pomožna funkcija za primerjave (R65)
// ============================================
// Enoten vir za "sprememba v %" izračune (digest primerjava z prejšnjim
// dnem, prihodnje poročila). Prej je bila logika vtisnjena v
// daily-digest.ts (samo za promet) — zdaj deljena za promet, naročila,
// povprečni račun IN napitnine.
//
// Pravila:
//   • prev <= 0 ali ne-finitno → null ("ni primerjave" — deljenje z 0
//     nima smisla; 2 naročili danes ob 0 včeraj = NE "∞ %")
//   • zaokroži na 1 decimalko (kot doslej: Math.round(x*10)/10)
//   • čisto — brez React/db odvisnosti, strežniško-varna (isti vzorec kot
//     tierLabelSl R62 / tierLabelSi R61b)
// ============================================

/** Sprememba iz prejšnje v trenutno vrednost v % (−za padec), ali null, če
 *  prejšnja vrednost ni primerljiva (0, negativna ali ne-število). */
export function pctChange(current: number, previous: number): number | null {
  const cur = Number(current)
  const prev = Number(previous)
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev <= 0) return null
  return Math.round(((cur - prev) / prev) * 1000) / 10
}
