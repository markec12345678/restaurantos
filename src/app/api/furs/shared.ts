// ============================================
// FURS DELJENE FUNKCIJE
// FIX F4 MEDIUM: Izvlečena parseVatBreakdown iz obeh route datotek
// Da se izognemo dvojnikom — če eno popravijo in druge ne,
// se bodo računi razlikovali med batch in single verify
// ============================================

// P1-9: Zod validacija entries — neveljavne stopnje/osnove se FILTRIRAJO
// (prej: NaN rate ali neštevilska osnova bi se tiho zapisala v FURS XML!)
import { z } from 'zod'

const vatEntrySchema = z.object({
  base: z.number().optional(),
  vat: z.number().optional(),
})

/**
 * Razčleni vatBreakdown v strukturo za FURS overitev
 * Format v bazi: {"22": {"base": 10.0, "vat": 2.2}, "9.5": {"base": 5.0, "vat": 0.475}}
 *
 * R150 (repo issue #33): Receipt.vatBreakdown je po migraciji 0022 JSONB —
 * tolerantni vhod: legacy JSON string ALI native object (struct iz baze).
 *
 * @param vatBreakdownInput JSON niz ALI native object iz Receipt.vatBreakdown
 * @param fallbackTotal Če je vatBreakdown prazen, generiraj fallback s to vsoto
 * @param fallbackVatRate DDV stopnja za fallback (privzeto 22%)
 */
export function parseVatBreakdown(
  vatBreakdownInput: string | Record<string, unknown> | null | undefined,
  fallbackTotal?: number,
  fallbackVatRate?: number
): Array<{ rate: number; baseAmount: number; vatAmount: number }> {
  try {
    // R150 (#33): struct (JSONB) gre DIREKTNO v obdelavo, string skozi JSON.parse
    const parsed: unknown = (vatBreakdownInput !== null && typeof vatBreakdownInput === 'object')
      ? vatBreakdownInput
      : JSON.parse((vatBreakdownInput as string) || '{}')
    // P1-9: validiraj strukturo {stopnja: {base, vat}} — neveljavni vnosi
    // (npr. null, string vrednosti, NaN stopnje) se preskočijo
    const result = (parsed && typeof parsed === 'object' ? Object.entries(parsed as Record<string, unknown>) : [])
      .map(([rate, amounts]) => {
        const rateNum = Number(rate)
        if (!Number.isFinite(rateNum)) return null
        const validated = vatEntrySchema.safeParse(amounts)
        if (!validated.success) return null
        return {
          rate: rateNum,
          baseAmount: validated.data.base || 0,
          vatAmount: validated.data.vat || 0,
        }
      })
      .filter((e): e is { rate: number; baseAmount: number; vatAmount: number } => e !== null)

    // Če je vatBreakdown prazen ali brez veljavnih postavk, generiraj fallback
    if (result.length === 0 && fallbackTotal && fallbackTotal > 0) {
      const vatRate = fallbackVatRate || 22
      const baseAmount = fallbackTotal / (1 + vatRate / 100)
      const vatAmount = fallbackTotal - baseAmount
      result.push({ rate: vatRate, baseAmount, vatAmount })
    }

    return result
  } catch {
    // Če JSON parse ne uspe, generiraj fallback DDV postavko
    if (fallbackTotal && fallbackTotal > 0) {
      const vatRate = fallbackVatRate || 22
      const baseAmount = fallbackTotal / (1 + vatRate / 100)
      const vatAmount = fallbackTotal - baseAmount
      return [{ rate: vatRate, baseAmount, vatAmount }]
    }
    return []
  }
}
