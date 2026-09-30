// ============================================
// close-shift-canon.ts — R185 (A6): enoten ZAPIRALNI kanon smene
// ============================================
// Forenzika A6 (trojni pisec smene): tri rute zaprejo CashRegisterShift —
//   (1) PUT /api/cash-register/[id]  — R104: pogojni updateMany CAS ✅
//   (2) POST /api/end-of-day → closeShift — R110 EOD-1: pogojni updateMany CAS ✅
//   (3) POST /api/reports/eod → closeShiftTransaction — NEPOGOJEN update({
//       where: { id } }) z read-check znotraj tx ❌ — TOCTOU double-close,
//       ISTI razred kot R104 C1 / R110 EOD-1 (R110 je popravil pisec (2),
//       ta pisec je ostal divergenten): pod READ COMMITTED oba sočasna
//       close-a prebereta status 'open' (read-check NE ščiti) → oba prebita
//       do pisanja → last-writer-wins na finančnih agregatih
//       (cashSales/expectedCash/cashDifference iz DRUGAČNEGA snapshot-a
//       plačil) + dup audit log (CLOSE_REGISTER_SHIFT ×2).
//
// KANON (R185): EN zapiralni pisec — closeShiftCasIfOpen(tx, shiftId, data):
// pogojni updateMany { id, status: 'open' } je avtoritativna vrata —
// count=1 → TA klic je zaklenil izmeno; count=0 → izgubljena tekma (že
// zaprta med branjem in pisanjem) → klicatelj spoštljivo javi
// SHIFT_ALREADY_CLOSED oziroma vrne idempotentno null vejo (pariteta R104/
// R110 pogodb). Vsa tri pisalna mesta sedaj kličejo TA kanon —
// drift-gate: tests/unit/security/r185-shift-close-canon.test.ts
// (fs-pini konsumatorjev + negativni pini starega stanja).
//
// Z-pisi NE sodijo sem (neprizadeti): ostajajo v R110 upsert kanonu
// upsertZReportForDay (Serializable tx + advisory ključavnica
// 'z-report:{locationId}:{date}') — A6 trojni pisec je s tem ENTITETNO
// kanoniziran: enotesmerna derivacija totals, nič divergentnih izvodov.
// ============================================

import type { Prisma } from '@prisma/client'

/** Pogodba napake — klicatelji preslikajo v 400/409 (pariteta starega stanja) */
export const SHIFT_ALREADY_CLOSED = 'SHIFT_ALREADY_CLOSED'

export interface ShiftCloseAggregateData {
  /** privzeto new Date() ob klicu (vse tri rute so imele closedAt = trenutek zaprtja) */
  closedAt?: Date
  closingCash: number
  expectedCash: number
  cashDifference: number
  cashSales: number
  cardSales: number
  mobileSales: number
  alternateSales: number
  totalSales: number
  totalOrders: number
  totalDiscounts: number
  totalTips: number
  totalVoided: number
  /** samo cash-register pot izračuna split plačila; eod poti polja ne pišejo (pariteta starega stanja) */
  splitPayments?: number
  /** vsota vračil za Z-report (Test 4.2) — samo cash-register pot */
  totalRefunds?: number
  notes?: string
}

/**
 * EDINI zapiralni pisec CashRegisterShift (A6 kanon, R185).
 *
 * Pogojni updateMany (where { id, status: 'open' }) — vrne `true`, če je TA
 * klic zaklenil izmeno; `false` = izgubljena tekma (status ni več 'open').
 * Klicatelj loči: `false` → SHIFT_ALREADY_CLOSED (400/409) ali idempotentna
 * veja "izmena že zaprta" (end-of-day EOD-1 pogodba: return null).
 */
export async function closeShiftCasIfOpen(
  tx: Prisma.TransactionClient,
  shiftId: string,
  data: ShiftCloseAggregateData,
): Promise<boolean> {
  const casClose = await tx.cashRegisterShift.updateMany({
    where: { id: shiftId, status: 'open' },
    data: {
      status: 'closed',
      closedAt: data.closedAt ?? new Date(),
      closingCash: data.closingCash,
      expectedCash: data.expectedCash,
      cashDifference: data.cashDifference,
      cashSales: data.cashSales,
      cardSales: data.cardSales,
      mobileSales: data.mobileSales,
      alternateSales: data.alternateSales,
      totalSales: data.totalSales,
      totalOrders: data.totalOrders,
      totalDiscounts: data.totalDiscounts,
      totalTips: data.totalTips,
      totalVoided: data.totalVoided,
      ...(data.splitPayments !== undefined ? { splitPayments: data.splitPayments } : {}),
      ...(data.totalRefunds !== undefined ? { totalRefunds: data.totalRefunds } : {}),
      notes: data.notes || '',
    },
  })
  return casClose.count > 0
}
