// ============================================
// G2 — SALE-CHAIN COGS BUSINESS-DAY BUCKETIRANJE (#152 korak 2, R216)
// ============================================
// VRZEL (docs/INVENTORY-CHAIN.md §5 G2): prihodki so se bucketirali na
// `Order.paidAt` (LJ poslovni dan — fiskalni kanon, P2-08), COGS pa na
// `StockTransaction.createdAt` (čas ognja). Naročilo ob 23:50 / plačilo ob
// 00:10 je razdelilo bruto maržo na dva dni: dan D je imel COGS brez
// prihodka, dan D+1 prihodek brez COGS.
//
// FIX (kanon pariteta, usklajeno z #148 ljubljanaDayBounds): sale-chain
// StockTransactions ('sale' + 'return' — vsi pisatelji nastavijo orderId v
// isti tx: deduct-recipe/direct/added, public/online-order, glovo/wolt,
// void-stock-return) se bucketirajo na LJ poslovni dan prodaje =
// `order.paidAt` (ISTI kanon kot prihodki). Fallback BIT-FOR-BIT: brez
// plačanega naročila (orderId null ALI order.paidAt null — neplačana/
// preklicana naročila) ostane bucketing na času ognja (createdAt) = prejšnje
// vedenje. Ne-naročilni tipi (procurement, write-off, adjustment, batch-*)
// ostanejo na času ognja — to so zalogo dogodki brez parjenega prihodka.
//
// Relacija StockTransaction.order (0026_stocktx_order_relation) omogoča
// Prisma relation filter brez ročnih joinov.
//
// KANONIČNA LASTNOST: za vsak posamezen StockTransaction velja TOČNO ENA
// veja (A: order.paidAt v oknu  XOR  B: paidAt null + createdAt v oknu) —
// brez dvojnega štetja in brez izgube vrstic:
//   • 23:50 ognjen / 00:10 plačan  → branch A (poslovni dan D+1), NE branch B
//     (paidAt ni null) → dan D ga ne vidi več, dan D+1 ga šteje ENKRAT;
//   • neplačano naročilo           → branch B (createdAt) = kot prej;
//   • brez naročila                → branch B (createdAt) = kot prej.

/** Tipi, ki sledijo poslovnemu dnevu prodaje (order.paidAt). */
export const SALE_CHAIN_COGS_TYPES = ['sale', 'return'] as const

/**
 * Okenski filter za sale-chain COGS po poslovnem dnevu prodaje.
 * Vrne OR-veje za vstavitev v starševski where (implicitni AND z ostalimi
 * ključi, npr. inventoryItem.locationId scope).
 *
 * @param start  vključno spodnja meja okna (LJ polnoč)
 * @param end    zgornja meja okna (route-določena: vključna zadnja ms ALI
 *               ekskluzivna polnoč — kozument podeduje ISTO semantiko kot
 *               prihodkovni where, ki deli ta okna)
 */
export function buildSaleCogsWindowFilter(start: Date, end: Date): Array<Record<string, unknown>> {
  return [
    // (A) prodaja/storno, katerih naročilo je plačano v oknu → poslovni dan
    //     prodaje (order.paidAt) — brez omejitve na createdAt ognja
    {
      type: { in: [...SALE_CHAIN_COGS_TYPES] },
      order: { paidAt: { gte: start, lte: end } },
    },
    // (B) fallback BIT-FOR-BIT: sale-chain brez plačanega naročila (gol orderId
    //     ALI order.paidAt null) → čas ognja (createdAt), kot prej
    {
      type: { in: [...SALE_CHAIN_COGS_TYPES] },
      createdAt: { gte: start, lte: end },
      OR: [{ orderId: null }, { order: { paidAt: null } }],
    },
  ]
}

/**
 * Veja za ne-naročilne tipe (procurement, write-off, adjustment, batch-*) —
 * ostanejo na času ognja (createdAt), zalogo dogodki brez parjenega prihodka.
 */
export function buildOtherStockTypesWindowFilter(start: Date, end: Date): Record<string, unknown> {
  return {
    type: { notIn: [...SALE_CHAIN_COGS_TYPES] },
    createdAt: { gte: start, lte: end },
  }
}
