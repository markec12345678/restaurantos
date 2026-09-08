import { db } from './db'
import type { PrismaClient } from '@prisma/client'

/** Transaction-compatible client type — accepts either PrismaClient or tx from $transaction callback */
export type DbClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

/**
 * Atomically get and increment a counter value.
 * Uses upsert with increment to prevent race conditions.
 *
 * Counter names: "orderNumber", "receiptNumber"
 *
 * @param tx Optional transaction client — when provided, the counter increment
 *           runs inside the caller's transaction, preventing gaps on rollback.
 * @param scope Optional scope (npr. locationId) — P1-7: številčenje mora biti
 *              po lokaciji (orderNumber, receiptNumber, po FURS celo po
 *              poslovnem prostoru). Scope se priključi imenu: `name@scope`.
 *              Brez scope-a se uporabi globalni counter (backward compat).
 */
export async function getNextCounter(name: string, tx?: DbClient, scope?: string | null): Promise<number> {
  const client = tx || db
  const scopedName = scope ? `${name}@${scope}` : name
  const counter = await client.counter.upsert({
    where: { name: scopedName },
    update: { value: { increment: 1 } },
    create: { name: scopedName, value: 1 },
  })
  return counter.value
}

/**
 * P1-7: Izračunaj ime per-lokacijskega counterja.
 * Kraj vice: `name` ali `name@locationId` (brez lokacije = globalni counter).
 */
export function scopedCounterName(name: string, locationId?: string | null): string {
  return locationId ? `${name}@${locationId}` : name
}

/**
 * P1-7 (FURS): naslednja številka naročila ZA LOKACIJO.
 *
 * Poslovno pravilo: naročila se številčijo PO LOKACIJI (ne globalno).
 * Idempotentna samo-inicializacija: če per-lokacijski counter še ne obstaja,
 * se atomarno inicializira na MAX(orderNumber) obstoječih naročil te lokacije + 1
 * (prepreči P2002 trčenje z zgodovinskimi številkami po prehodu z globalnega številčenja).
 *
 * Implementacija je ENA atomarna SQL izjava (INSERT ... SELECT MAX ... ON CONFLICT):
 *  - counter obstaja → DO UPDATE value + 1 (klasična inkrementacija)
 *  - counter ne obstaja → vrednost = MAX("orderNumber" za lokacijo) + 1
 * Brez race windowa med branjem MAX in zapisom — varno tudi pri sočasnih POS terminalih.
 */
export async function getNextOrderNumber(locationId?: string | null, tx?: DbClient): Promise<number> {
  const client = tx || db
  if (!locationId) {
    // Brez lokacije (super admin / single-tenant brez Location zapisov): globalni counter
    return getNextCounter('orderNumber', client)
  }
  const name = scopedCounterName('orderNumber', locationId)
  const rows = await client.$queryRawUnsafe<Array<{ value: number }>>(
    `INSERT INTO "Counter" ("id", "name", "value")
     SELECT $1, $2, COALESCE(MAX(o."orderNumber"), 0) + 1
     FROM "Order" o WHERE o."locationId" = $3
     ON CONFLICT ("name") DO UPDATE SET "value" = "Counter"."value" + 1
     RETURNING "value"`,
    crypto.randomUUID(), name, locationId
  )
  return rows[0]?.value ?? 1
}

/**
 * P1-7 (FURS): naslednja številka računa za lokacijo, format R-YYYY-NNNNNN.
 *
 * Poslovno pravilo (FURS): zaporedna številka računa je VEZANA NA POSLOVNI PROSTOR
 * (= lokacija) in koledarsko leto. Globalno številčenje prek lokacij NI skladno,
 * če ima vsaka lokacija svoj premisesId.
 *
 * Samo-inicializacija: counter `receiptNumber-YYYY@locationId` se ob prvem klicu
 * atomarno inicializira na MAX zaporedno številko obstoječih računov te lokacije
 * v tem letu + 1 (parsa zadnji NNNNNN iz receiptNumber).
 */
export async function getNextReceiptNumber(locationId?: string | null, tx?: DbClient): Promise<string> {
  const client = tx || db
  const year = new Date().getFullYear()
  if (!locationId) {
    // Brez lokacije: globalni letni counter (backward compat — single-tenant)
    const counterName = `receiptNumber-${year}`
    const seq = await getNextCounter(counterName, client)
    return `R-${year}-${String(seq).padStart(6, '0')}`
  }
  const name = scopedCounterName(`receiptNumber-${year}`, locationId)
  const prefix = `R-${year}-`
  const rows = await client.$queryRawUnsafe<Array<{ value: number }>>(
    `INSERT INTO "Counter" ("id", "name", "value")
     SELECT $1, $2, COALESCE(
              MAX(CAST(NULLIF(SUBSTRING("receiptNumber" FROM '[0-9]+$'), '') AS INTEGER)), 0
            ) + 1
     FROM "Receipt"
     WHERE "locationId" = $3 AND "receiptNumber" LIKE $4
     ON CONFLICT ("name") DO UPDATE SET "value" = "Counter"."value" + 1
     RETURNING "value"`,
    crypto.randomUUID(), name, locationId, `${prefix}%`
  )
  const seq = rows[0]?.value ?? 1
  return `${prefix}${String(seq).padStart(6, '0')}`
}

/**
 * P1-6: Poišči privzeto lokacijo za zapise brez eksplicitne lokacije.
 *
 * Vrstni red: (1) edina aktivna lokacija, (2) edina lokacija,
 * (3) nič (multi-tenant brez session konteksta — zapis ostane globalni).
 *
 * Uporaba: public/kiosk, delivery webhooki (brez session), mobile brez session,
 * seed poti — kjer ni avtoriziranega zaposlenega z lokacijo.
 */
export async function resolveDefaultLocationId(tx?: DbClient): Promise<string | null> {
  const client = tx || db
  const active = await client.location.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (active) return active.id
  //Fallback: neaktivna lokacija (raje kot NULL — ohrani tenant integriteto)
  const any = await client.location.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  return any?.id ?? null
}
