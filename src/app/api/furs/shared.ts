// ============================================
// FURS DELJENE FUNKCIJE
// FIX F4 MEDIUM: Izvlečena parseVatBreakdown iz obeh route datotek
// Da se izognemo dvojnikom — če eno popravijo in druge ne,
// se bodo računi razlikovali med batch in single verify
// ============================================

/**
 * Razčleni vatBreakdown JSON niz v strukturo za FURS overitev
 * Format v bazi: {"22": {"base": 10.0, "vat": 2.2}, "9.5": {"base": 5.0, "vat": 0.475}}
 *
 * @param vatBreakdownStr JSON niz iz Receipt.vatBreakdown
 * @param fallbackTotal Če je vatBreakdown prazen, generiraj fallback s to vsoto
 * @param fallbackVatRate DDV stopnja za fallback (privzeto 22%)
 */
export function parseVatBreakdown(
  vatBreakdownStr: string,
  fallbackTotal?: number,
  fallbackVatRate?: number
): Array<{ rate: number; baseAmount: number; vatAmount: number }> {
  try {
    const parsed = JSON.parse(vatBreakdownStr || '{}')
    const result = Object.entries(parsed).map(([rate, amounts]) => ({
      rate: Number(rate),
      baseAmount: (amounts as { base: number; vat: number }).base || 0,
      vatAmount: (amounts as { base: number; vat: number }).vat || 0,
    }))

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
