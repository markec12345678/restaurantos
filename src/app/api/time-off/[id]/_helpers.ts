// ============================================
// TIME-OFF REVIEW — CAS state machine kanon (R107)
// ============================================
// R107 (TOCTOU razred iz R100–R106): approve/reject ruti sta imeli NEPOGOJEN
// `update({ where: { id } })` za stale scoped findUnique read-om:
//
//   TO-1a (HIGH) state-machine bypass: rejected prošnja je bila mogoče
//        odobriti (approved → rejected → approved ping-pong brez sledi),
//        cancelled prošnja pa aktivirati — brez vsakega guard-a.
//   TO-1b (HIGH) approve ∥ reject race: dva managerja sočasno — oba prebereta
//        stale status, oba NEPOGOJENA update-a → last-writer-wins, reviewedAt
//        dvakrat prepisan, končno stanje odvisno od vrstnega reda (audit
//        neskladje: en manager vidi "approved", drugi "rejected").
//   TO-1c (MEDIUM) replay overwrite: ponovljen approve že odobrene prošnje
//        je povozil reviewedAt (izgubljen prvotni revizijski čas).
//   TO-1d (MEDIUM) reviewedBy NIKOLI zapisan — schema ima stolpec, ruti ga
//        nista nastavili (revizijska vrzel: kdo je odobril?).
//
// KANON (zrcali R104 casUpdate / R105 PO-5 CAS / R106 stock kanon):
//   ATOMARNI pogojni `updateMany({ id, status: 'pending', (+employee scope) })`
//   — count 1 = zmagovalna prevrstava (reviewedBy + reviewedAt v istem zapisu);
//   count 0 → tx-fresh re-read razloči: 404 (ne obstaja / izven scope) ·
//   200 replay (isti izid, BREZ overwrite-a revizijskih polj) ·
//   409 konflikt (različen status — osveži seznam).
//   Scope ZNOTRAJ where → atomarna avtorizacija (scope drift med readom in
//   pisanjem nemogoč).
//
// Enostavna enovrstična CAS je tukaj zadostna (ni multi-row invariant kot v
// stock/PO kanonih) — advisory lock NI potreben; pariteta z R104 C1
// (cash-shift double-close) vzorcem.

import { db } from '@/lib/db'
import { isWithinScope } from '@/lib/tenant-scope'

export type TimeOffDecision = 'approve' | 'reject'

const TARGET_STATUS: Record<TimeOffDecision, string> = {
  approve: 'approved',
  reject: 'rejected',
}

export interface TimeOffReviewResult {
  request: Record<string, unknown>
  /** true = idempotentni replay (prošnja je že bila v tem stanju) */
  replay: boolean
}

/**
 * R107 TO-1: CAS prevrstava prošnje pending → approved|rejected.
 * Samo pending prošnja je prevrstljiva; replay (isti izid) → 200 brez
 * overwrite-a, konflikt (drugo stanje) → strukturirani 409.
 */
export async function reviewTimeOffRequest(opts: {
  id: string
  decision: TimeOffDecision
  sessionLocationId: string | null
  reviewedBy: string | null
}): Promise<TimeOffReviewResult> {
  const { id, decision, sessionLocationId, reviewedBy } = opts
  const targetStatus = TARGET_STATUS[decision]

  const claim = await db.timeOffRequest.updateMany({
    where: {
      id,
      status: 'pending',
      ...(sessionLocationId ? { employee: { locationId: sessionLocationId } } : {}),
    },
    data: {
      status: targetStatus,
      reviewedAt: new Date(),
      reviewedBy, // R107 TO-1d: revizijska vrzel zaprta
    },
  })

  if (claim.count === 1) {
    const updated = await db.timeOffRequest.findUnique({
      where: { id },
      include: { employee: { select: { id: true, name: true, locationId: true } } },
    })
    if (!updated) {
      // Teoretično nemogoče (CAS je pravkar uspel) — fail-closed
      throw { error: 'Prošnja za dopust ni najdena', status: 404 }
    }
    return { request: updated as unknown as Record<string, unknown>, replay: false }
  }

  // count 0 — razloči 404 / replay 200 / konflikt 409 proti svežemu stanju
  const current = await db.timeOffRequest.findUnique({
    where: { id },
    include: { employee: { select: { locationId: true } } },
  })
  if (!current || !isWithinScope(sessionLocationId, current.employee.locationId)) {
    throw { error: 'Prošnja za dopust ni najdena', status: 404 }
  }
  if (current.status === targetStatus) {
    // Idempotentni replay — isti izid, revizijska polja NISO prepisana
    return { request: current as unknown as Record<string, unknown>, replay: true }
  }
  throw {
    error: `Prošnja je že obdelana (trenutno stanje: ${current.status}) — osvežite seznam`,
    status: 409,
  }
}
