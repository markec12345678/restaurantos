// ============================================
// KATALOG DOBAVITELJA — DB DOSTOPNA PLAST (P1-13, epic #115, runda 131)
// ============================================
//
// Companion kanonu '@/lib/procurement/pack-size' (ki je ČIST): tukaj živi
// bulk branje aktivnih katalog vrstic, ki ga delita draft-po (POST
// /api/reorder/draft-po) in reorder GET enrichment. Ločeno od kanona po
// hišnem vzorcu R130 ('@/lib/suppliers/price-history-db').
//
// BACK-COMPAT BRANJE (best-effort): klicatelji NE SMEJO podreti obstoječega
// toka. Starejši trap-DB testni mocki (r129-reorder-get, r129-reorder-draft-po,
// r130-price-history-routes) ne definijo supplierItem modela — kolektor model
// preveri STRUKTURNO (runtime truthy + typeof findMany) in ob odsotnosti vrne
// prazno mapo (enakovredno "brez kataloga" → legacy base-unit vrstica). Enako
// ob DB napaki (logger.warn, brez throwa) — katalog enrichment je vedno
// opcijsko obogatitev, nikoli podpora denarnemu toku.
// ============================================

import { Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'

/** Minimalna struktura aktivne katalog vrstice (pack-size kanon konsumira). */
export interface SupplierCatalogLine {
  supplierId: string
  inventoryItemId: string
  /** Prisma.Decimal ob realnem branju (toNum za izračun). */
  packQty: Prisma.Decimal | number | string
  packUnit: string
  /** QUOTED cena iz cenika na PAKET (Decimal(12,4)). */
  pricePerPack: Prisma.Decimal | number | string
  minOrderPacks: number
}

/** Strukturni podkvadrat Prisma klienta (hišni vzorec SupplierPriceDbClient). */
export type SupplierCatalogDbClient = Pick<Prisma.TransactionClient, 'supplierItem'>

/** Ključ mape katalog vrstic: (supplierId, inventoryItemId). */
export function catalogLineKey(supplierId: string, inventoryItemId: string): string {
  return `${supplierId}|${inventoryItemId}`
}

/**
 * Aktivne katalog vrstice za pare (dobavitelj, artikel) — ENA poizvedba
 * (batched, brez N+1). Ključ mape: catalogLineKey(supplierId, itemId).
 * Manjkajoč/odjavljen katalog → par ni v mapi (klicatelj pade na legacy
 * base-unit vrstico — kanon #2).
 */
export async function collectActiveCatalogLines(
  client: SupplierCatalogDbClient,
  supplierIds: readonly string[],
  inventoryItemIds: readonly string[],
): Promise<Map<string, SupplierCatalogLine>> {
  const map = new Map<string, SupplierCatalogLine>()
  if (supplierIds.length === 0 || inventoryItemIds.length === 0) return map

  // Strukturni guard — starejši trap-DB mocki ne definijo modela (back-compat).
  const model: unknown = client.supplierItem
  if (!model || typeof (model as { findMany?: unknown }).findMany !== 'function') return map

  try {
    const rows = await (model as {
      findMany: (args: Record<string, unknown>) => Promise<Array<SupplierCatalogLine>>
    }).findMany({
      where: {
        supplierId: { in: [...supplierIds] },
        inventoryItemId: { in: [...inventoryItemIds] },
        isActive: true,
      },
      select: {
        supplierId: true,
        inventoryItemId: true,
        packQty: true,
        packUnit: true,
        pricePerPack: true,
        minOrderPacks: true,
      },
    })
    // @@unique(supplierId, inventoryItemId) → vsak par je enkraten.
    for (const row of rows) {
      map.set(catalogLineKey(row.supplierId, row.inventoryItemId), row)
    }
  } catch (err) {
    // Enrichment je best-effort — napaka kataloga ne sme podreti draft-po/reorder toka.
    logger.warn('R131', 'Branje kataloga dobavitelja ni uspelo (pade nazaj na base-unit vrstico)', err)
  }
  return map
}
