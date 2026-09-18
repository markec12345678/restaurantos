// ============================================
// LOCATION FALLBACK — skupna resolucija lokacije za create poti
// ============================================
// FIX QA 2026-09-18 (runda 36 + 37): Neon DB ima na več tabelah
// `locationId NOT NULL`, čeprav Prisma schema pravi `String?`
// (schema drift — migrate diff ni bil pognan ob dodajanju
// multi-location podpore). Prizadete tabele (empirično potrjeno
// prek P2011 Null constraint violation):
//   ZReport, HaccpEntry, Shift, StaffShift, OpeningHours.
// Npr. LoyaltyAccount JE nullable v DB → tam create z null deluje
// in NE sme dobiti injicirane lokacije (zato helper apliciramo SAMO
// na prizadete rute, ne globalno prek $extends).
//
// Resolucija (v redu zaporedja):
//   1. explicit (session.locationId ali body locationId)
//   2. employee.locationId (db lookup)
//   3. prva lokacija (createdAt asc) — cachirana za proces
//   4. null (klicatelj obnaša se kot prej — P2011 na NOT NULL tabelah)
//
// Uporaba v route POST:
//   const locationId = await resolveLocationId(
//     session?.locationId, session?.employeeId,
//   )
//   ... create({ data: { ..., locationId } })

import { db } from '@/lib/db'

/** Cache prve lokacije per serverless instanca (izogibi query ob vsakem create) */
let cachedFirstLocationId: string | null | undefined

/** Prva lokacija (createdAt asc) ali null, če je ni. Cachirana. */
export async function getFirstLocationId(): Promise<string | null> {
  if (cachedFirstLocationId !== undefined) return cachedFirstLocationId
  const first = await db.location.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  cachedFirstLocationId = first?.id ?? null
  return cachedFirstLocationId
}

/**
 * Resolve lokacijo za create: explicit → employee.locationId → prva lokacija → null.
 * Nikoli ne meče — null pomeni "ni česa injicirati" (klicatelj/route odloči).
 */
export async function resolveLocationId(
  explicit?: string | null,
  employeeId?: string | null,
): Promise<string | null> {
  if (explicit) return explicit

  if (employeeId) {
    const emp = await db.employee.findUnique({
      where: { id: employeeId },
      select: { locationId: true },
    })
    if (emp?.locationId) return emp.locationId
  }

  return getFirstLocationId()
}
