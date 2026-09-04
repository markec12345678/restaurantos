// ============================================
// EMPLOYEE REF RESOLVER — Soft ref → FK migracijski helper
//
// ISSUE #43: Veliko modelov ima soft ref String polja (cancelledBy, approvedBy,
// requestedBy, createdBy, postedBy) ki vsebujejo employeeId ali ime — katerokoli.
// Sedaj imamo prave FK polja (cancelledById, approvedById, itd.).
//
// Ta modul ponuja:
//   - resolveEmployeeRef(softRefValue) — preveri ali je soft ref dejansko employeeId
//     in vrne FK-ready { employeeId | null }
//   - setEmployeeRefDenormalized(softRef, fk) — sinhronizira obe polji:
//     ko nastaviš FK, denormalizira ime v soft ref polje (za prikaz v UI)
//   - getEmployeeRefStats() — števec koliko zapisov je še brez FK (migracijski dashboard)
// ============================================

import { db } from '@/lib/db'

export interface EmployeeRefResult {
  /** ID employee-ja če je bil soft ref veljaven, sicer null */
  employeeId: string | null
  /** Ali soft ref vrednost ustreza obstoječemu employee-u */
  isValid: boolean
  /** Ime employee-ja (za denormalizacijo) ali null če ne obstaja */
  employeeName: string | null
}

/**
 * Preveri ali je soft ref vrednost (ki je lahko employeeId ali ime) dejansko
 * veljaven employeeId.
 *
 * Uporaba v API rutah ob ustvarjanju/posodabljanju zapisov:
 *   const ref = await resolveEmployeeRef(body.cancelledBy)
 *   await db.order.update({
 *     where: { id },
 *     data: {
 *       cancelledBy: body.cancelledBy,           // ohrani soft ref (denorm)
 *       cancelledById: ref.employeeId,            // FK
 *     },
 *   })
 */
export async function resolveEmployeeRef(softRefValue: string | null | undefined): Promise<EmployeeRefResult> {
  if (!softRefValue || softRefValue.trim() === '') {
    return { employeeId: null, isValid: false, employeeName: null }
  }

  // 1. Poskusi kot employeeId (cuid je 24 znakov)
  const byId = await db.employee.findUnique({
    where: { id: softRefValue },
    select: { id: true, name: true },
  })
  if (byId) {
    return {
      employeeId: byId.id,
      isValid: true,
      employeeName: byId.name,
    }
  }

  // 2. Poskusi kot email (employee.email je @unique)
  const byEmail = await db.employee.findUnique({
    where: { email: softRefValue },
    select: { id: true, name: true },
  })
  if (byEmail) {
    return {
      employeeId: byEmail.id,
      isValid: true,
      employeeName: byEmail.name,
    }
  }

  // 3. Poskusi kot PIN (employee.pin je @unique)
  if (/^\d{4,6}$/.test(softRefValue)) {
    const byPin = await db.employee.findUnique({
      where: { pin: softRefValue },
      select: { id: true, name: true },
    })
    if (byPin) {
      return {
        employeeId: byPin.id,
        isValid: true,
        employeeName: byPin.name,
      }
    }
  }

  // 4. Ne najdemo — verjetno je soft ref samo ime (npr. "Janez Novak")
  // V tem primeru ne moremo vzpostaviti FK
  return {
    employeeId: null,
    isValid: false,
    employeeName: softRefValue, // ohrani ime za prikaz
  }
}

/**
 * Sinhroniziraj soft ref in FK polje.
 *
 * Uporaba ko imaš samo eno od obeh vrednosti:
 *   - Če imaš employeeId → set-aj FK + denormaliziraj ime v soft ref
 *   - Če imaš samo ime → set-aj soft ref, FK = null
 *
 * @param softRef - trenutna vrednost soft ref polja (npr. cancelledBy)
 * @param employeeId - ID employee-ja (če je poznan)
 * @returns Pripravljen objekt za oba polja: { softRef, fk }
 */
export async function syncEmployeeRef(
  softRef: string | null | undefined,
  employeeId: string | null | undefined,
): Promise<{ softRef: string; fk: string | null }> {
  // 1. Če imamo employeeId → prevzami, denormaliziraj ime
  if (employeeId) {
    const emp = await db.employee.findUnique({
      where: { id: employeeId },
      select: { name: true },
    })
    if (emp) {
      return { softRef: emp.name, fk: employeeId }
    }
    // employeeId ne obstaja — ignoriraj
  }

  // 2. Če imamo samo soft ref → poskusi resolvati v employeeId
  if (softRef) {
    const resolved = await resolveEmployeeRef(softRef)
    return {
      softRef: resolved.employeeName || softRef,
      fk: resolved.employeeId,
    }
  }

  // 3. Oba prazna
  return { softRef: '', fk: null }
}

/**
 * Migracijski dashboard — števec koliko zapisov še nima FK.
 *
 * @returns Statistika za vsako izmed 5 soft ref polj
 */
export async function getEmployeeRefStats(): Promise<{
  orderCancelledBy: { total: number; withFk: number; withoutFk: number; progress: number }
  staffShiftCreatedBy: { total: number; withFk: number; withoutFk: number; progress: number }
  purchaseOrderRequestedBy: { total: number; withFk: number; withoutFk: number; progress: number }
  purchaseOrderApprovedBy: { total: number; withFk: number; withoutFk: number; progress: number }
  journalEntryPostedBy: { total: number; withFk: number; withoutFk: number; progress: number }
  overall: { total: number; withFk: number; withoutFk: number; progress: number }
}> {
  const [
    orderTotal, orderWithFk,
    ssTotal, ssWithFk,
    poTotal, poReqWithFk, poApprWithFk,
    jeTotal, jeWithFk,
  ] = await Promise.all([
    db.order.count({ where: { cancelledAt: { not: null } } }), // samo preklicana naročila
    db.order.count({ where: { cancelledAt: { not: null }, cancelledById: { not: null } } }),
    db.staffShift.count(),
    db.staffShift.count({ where: { createdById: { not: null } } }),
    db.purchaseOrder.count(),
    db.purchaseOrder.count({ where: { requestedById: { not: null } } }),
    db.purchaseOrder.count({ where: { approvedById: { not: null } } }),
    db.journalEntry.count(),
    db.journalEntry.count({ where: { postedById: { not: null } } }),
  ])

  const makeStat = (total: number, withFk: number) => ({
    total,
    withFk,
    withoutFk: total - withFk,
    progress: total > 0 ? Math.round((withFk / total) * 1000) / 10 : 100,
  })

  const orderStat = makeStat(orderTotal, orderWithFk)
  const ssStat = makeStat(ssTotal, ssWithFk)
  const poReqStat = makeStat(poTotal, poReqWithFk)
  const poApprStat = makeStat(poTotal, poApprWithFk)
  const jeStat = makeStat(jeTotal, jeWithFk)

  const overallTotal = orderTotal + ssTotal + poTotal * 2 + jeTotal
  const overallWithFk = orderWithFk + ssWithFk + poReqWithFk + poApprWithFk + jeWithFk

  return {
    orderCancelledBy: orderStat,
    staffShiftCreatedBy: ssStat,
    purchaseOrderRequestedBy: poReqStat,
    purchaseOrderApprovedBy: poApprStat,
    journalEntryPostedBy: jeStat,
    overall: makeStat(overallTotal, overallWithFk),
  }
}
