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
 * R159 (R158-4): finančno-vidne rute (sales/vat/export) so prešle na LJ meje
 * (ljubljanaDayBounds).
 * R160 (P3-2): tudi employees/popular/reports-shifts/wallet-payment so
 * prešle na LJ meje (gte = bounds.start, lte→lt = bounds.end). Zadnji
 * konzument je SAMO compat sloj GET /api/shifts (StaffShift), ki mora
 * ostati v WRITE-PATH PARITETI s staff-shifts zapisom new Date('YYYY-MM-DD')
 * = UTC polnoč (:140/:156) — preklop zahteva usklajen write+read preklop
 * (ločen task, DEFER).
 */
export function endOfDayParam(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    return new Date(`${dateStr.trim()}T23:59:59.999Z`)
  }
  return new Date(dateStr)
}
