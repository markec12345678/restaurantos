// ============================================
// R182 (A2): SKUPNI PER-ITEM ZALOGOVNI KLJUČAVNICE — KANON
// ============================================
//
// A2 (docs/BUSINESS-CHAIN.md — divergentne ključavnice): trije zalogovni
// pisalni tokovi so mutirali InventoryItem.quantity MIMO R106 kanona
// ('inv-stock:<itemId>'):
//   - sale deduction (deduct-order.ts): BREZ advisory ključavnice (samo CAS
//     claim na inventoryDeducted + pogojni decrement),
//   - return-stock.ts: ključaval SAMO 'stock-return:<orderId>' (entitetno),
//   - PO receive (purchase-orders/[id]/_helpers.ts): ključaval SAMO
//     'hashtext(poId)' (entitetno).
// R106 kanon ('inv-stock:<itemId>') so uporabljali samo odpis/prilagoditev/
// restock (inventory/_helpers/stock-mutations.ts) + waste + stocktakes +
// batch-preparations. Posledica divergence: cross-domena sočasnost
// (prodaja ∥ odpis, vračilo ∥ prevzem ...) se NI serializirala na artiklu →
// preplet StockTransaction revizijskih vrstic (previousQty → newQty ni bil
// brezvsnežna veriga) + SSI abort-noise na R106 straneh.
//
// KANON (R182): vsaka per-item zalogovna mutacija pridobi
// pg_advisory_xact_lock(hashtext('inv-stock:' + itemId)) prek
// acquireInvStockLocks():
//   * ključavnice artiklov so vedno LISTI lock grafa — pridobljene ŠELE ko
//     je entitetna ključavnica (order-write / stock-return / poId / CAS
//     claim) že noter,
//   * vedno SORTIRANE + deduplicirane (določen globalni vrstni red →
//     deadlock nemogoč; pariteta R181 acquireCheckIdLocks),
//   * brez izolacijskih sprememb: pisalno izključitev na artiklu zagotavlja
//     advisory lock; pogojni updateMany (gte) ostane obrambna globina.
//     (Serializable upgrade na vroči prodajni poti bi DODAL P2034
//     retry-noise — nasprotno cilju A2; R105 prevzem ostane Serializable.)
//
// Enoten lock vesolj: odpis/prilagoditev/restock (R106) + waste + stocktake
// + batch + PREVZEM + PRODAJA + VRAČILO — vse na istem ključu.
// ============================================
import type { Prisma } from '@prisma/client'

type TransactionClient = Prisma.TransactionClient

/** R106/R182: skupni per-item lock ključ — serializira VSE zalogovne pisalne poti. */
export function inventoryStockLockKey(inventoryItemId: string): string {
  return `inv-stock:${inventoryItemId}`
}

/**
 * R182 (A2): pridobi inv-stock ključavnice za VSE artikle, ki jih bo
 * transakcija mutirala — sortirano + deduplicirano (enosmeren graf,
 * deadlock nemogoč). Null/undefined id-ji (npr. PO postavke brez povezave
 * na zalogo) se tiho preskočijo. Kliči ŠELE po entitetni ključavnici /
 * CAS claim-u in PRED prvo mutacijo InventoryItem.quantity.
 */
export async function acquireInvStockLocks(
  tx: TransactionClient,
  inventoryItemIds: (string | null | undefined)[],
): Promise<void> {
  const ids = [...new Set(inventoryItemIds.filter((id): id is string => !!id))].sort()
  for (const id of ids) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${inventoryStockLockKey(id)}))`
  }
}
