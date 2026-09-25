// ============================================
// ZGODOVINA NABAVNIH CEN — DB DOSTOPNA PLAST (P1-08, epic #115, runda 130)
// ============================================
//
// Companion kanonu '@/lib/suppliers/price-history' (ki je ČIST): tukaj živijo
// bulk branja, ki jih rute (reorder GET, recipes GET, price-history GET/POST)
// delijo. Ločeno od kanona po vzorcu R129 (canon.ts brez DB — preslikava v
// rutah/_helpers).
//
// BACK-COMPAT BRANJE (best-effort): enrichment klicateljev (reorder, recipes)
// NE SME podreti obstoječega toka. Starejši trap-DB testni mocki (npr.
// tests/unit/api/r129-reorder-get.test.ts) ne definirajo supplierPriceHistory/
// supplier modelov — kolektorji zato model preverijo STRUKTURNO (runtime
// truthy + typeof findMany) in ob odsotnosti vrnejo prazno mapo (enakovredno
// "brez zgodovine" → polja padejo nazaj na costPerUnit). Enako ob DB napaki
// (logger.warn, brez throwa) — enrichment je vedno opcijsko obogatitev.
// ============================================

import { Prisma } from '@prisma/client'
import { toNum } from '../decimal'
import { logger } from '@/lib/logger'

/** Minimalna struktura vrstice zadnje cene. */
export interface LatestSupplierPrice {
  supplierId: string
  inventoryItemId: string
  /** Prisma.Decimal ob realnem prevzemu (toNum za izpis). */
  unitPrice: Prisma.Decimal | number | string
  observedAt: Date
  source: string
}

/**
 * Strukturni podkvadrat Prisma klienta (hišni vzorec ReorderDbClient iz
 * '@/lib/reorder/canon'). Runtime strukturni guard (spodaj) poleg tega
 * varuje starejše trap-DB mocke brez teh modelov.
 */
export type SupplierPriceDbClient = Pick<
  Prisma.TransactionClient,
  'supplier' | 'supplierPriceHistory'
>

/** Ključ mape zadnjih cen: (supplierId, inventoryItemId). */
export function latestPriceKey(supplierId: string, inventoryItemId: string): string {
  return `${supplierId}|${inventoryItemId}`
}

/**
 * Zadnja cena per (dobavitelj, artikel) — ENA poizvedba (findMany desc po
 * observedAt + dedup prve vrstice per par v JS; hišni vzorec
 * collectOpenPurchaseOrders/delivery-facts iz reorder kanona). Opcijski
 * `supplierIds` filter za poizvedbe "samo ti dobavitelji".
 */
export async function collectLatestSupplierPrices(
  client: SupplierPriceDbClient,
  inventoryItemIds: readonly string[],
  opts?: { supplierIds?: readonly string[] },
): Promise<Map<string, LatestSupplierPrice>> {
  const map = new Map<string, LatestSupplierPrice>()
  if (inventoryItemIds.length === 0) return map

  // Strukturni guard — starejši trap-DB mocki ne definijo modela (back-compat).
  const model: unknown = client.supplierPriceHistory
  if (!model || typeof (model as { findMany?: unknown }).findMany !== 'function') return map

  try {
    const rows = await (model as {
      findMany: (args: Record<string, unknown>) => Promise<Array<{
        supplierId: string
        inventoryItemId: string
        unitPrice: Prisma.Decimal | number | string
        observedAt: Date
        source: string
      }>>
    }).findMany({
      where: {
        inventoryItemId: { in: [...inventoryItemIds] },
        ...(opts?.supplierIds && opts.supplierIds.length > 0
          ? { supplierId: { in: [...opts.supplierIds] } }
          : {}),
      },
      orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        supplierId: true,
        inventoryItemId: true,
        unitPrice: true,
        observedAt: true,
        source: true,
      },
    })
    // DESC vrstni red → prva vrstica per par je ZADNJA cena.
    for (const row of rows) {
      const key = latestPriceKey(row.supplierId, row.inventoryItemId)
      if (!map.has(key)) map.set(key, row)
    }
  } catch (err) {
    // Enrichment je best-effort — napaka zgodovine ne sme podreti reorder/recipes toka.
    logger.warn('R130', 'Branje zgodovine nabavnih cen ni uspelo (pade nazaj na costPerUnit)', err)
  }
  return map
}

/**
 * Preslikava ime dobavitelja → Supplier.id (soft-ref `InventoryItem.supplier`
 * je STRING; Supplier.name je @@unique — hišni vzorec POST /api/reorder/draft-po).
 * Manjkajoča imena v bazi enostavno niso v mapi (klicatelj pade nazaj na costPerUnit).
 */
export async function resolveSupplierIdsByNames(
  client: SupplierPriceDbClient,
  names: readonly string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const wanted = [...new Set(names.map(n => n.trim()).filter(Boolean))]
  if (wanted.length === 0) return map

  // Strukturni guard — pariteta collectLatestSupplierPrices (back-compat mocki).
  const model: unknown = client.supplier
  if (!model || typeof (model as { findMany?: unknown }).findMany !== 'function') return map

  try {
    const rows = await (model as {
      findMany: (args: Record<string, unknown>) => Promise<Array<{ id: string; name: string }>>
    }).findMany({
      where: { name: { in: wanted } },
      select: { id: true, name: true },
    })
    for (const row of rows) map.set(row.name, row.id)
  } catch (err) {
    logger.warn('R130', 'Preslikava dobaviteljev ni uspela (pade nazaj na costPerUnit)', err)
  }
  return map
}

/**
 * Zadnja cena za par ali undefined (pomočnik za klicalce enrichmenta).
 * Cene <= 0 se tretirajo kot "brez zgodovine" (obrambno — zajem jih sicer
 * sploh ne piše, POST pa validira PRICE_INVALID).
 */
export function pickLatestPrice(
  prices: Map<string, LatestSupplierPrice>,
  supplierId: string | undefined,
  inventoryItemId: string,
): LatestSupplierPrice | undefined {
  if (!supplierId) return undefined
  const row = prices.get(latestPriceKey(supplierId, inventoryItemId))
  if (!row) return undefined
  if (!(toNum(row.unitPrice) > 0)) return undefined
  return row
}
