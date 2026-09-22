// ============================================
// DATUMSKI PARAMETRI — varno parsenje obsegov
// ============================================

/**
 * FIX r35: 'yyyy-MM-dd' KONEC obsega mora biti 23:59:59.999, NE polnoč.
 *
 * Prej je bilo `paidAt.lte = new Date('2026-09-18')` = polnoč UTC → celoten
 * zadnji dan obsega je bil izključen iz poročil (današnja plačila nikoli
 * vidna v /api/reports/sales, popular, vat, employees, shifts, export,
 * wallet-payment in shifts) — QA r35 repro: dashboard 61,65 € vs reports 0,00 €.
 *
 * Za polne ISO datetime stringe (z 'T') se obnaša kot new Date() — ni spremembe.
 * gte strani ostane new Date(startDate) = polnoč UTC (obstoječe vedenje).
 */
export function endOfDayParam(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    return new Date(`${dateStr.trim()}T23:59:59.999Z`)
  }
  return new Date(dateStr)
}
