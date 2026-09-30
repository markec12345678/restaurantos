// ============================================
// GENERATOR: docs/BUSINESS-CHAIN.md (§10 — epic #144, R180)
// ============================================
//
// Epik #144 §10 "Business-chain verification": *Validate the full data
// chain: menu → recipe → order → KDS → stock → waste → procurement →
// supplier → cost → finance/reporting.* Za vsako ključno entiteto
// dokumentiramo verigo **source of truth → writers → readers → derived
// values → audit** — kot strukturno verifikacijo kode, NE kot produkcijsko
// validacijo (glej VALIDATION-MATRIX §8 za dokazne kanale).
//
// NAČELA (fail-closed, kanon #144):
//  - Vsak sidro (Prisma model, writer/reader pot, §6 moduleId, audit akcija)
//    je preverjen ob generaciji: neobstoječ model/pot/modul/akcija = generator
//    PADÉ z izpisom VSEH napak (brez "duh" sidr).
//  - Kjer entiteta NIMA namenskih AuditLog akcij, je to IZRECNO zabeleženo
//    (auditNote) — nikoli tiho.
//  - Ledger princip: kjer piše "ledger = sled", je revizijska sled DB vrstica
//    (StockTransaction / LoyaltyTransaction / GiftCardTransaction), ne audit.
//  - DETERMINISTIČNO: brez timestampov / naključja — regeneracija na istem
//    drevesu je BITNIČNO ENAKA (gate: `bun run chain && git diff --exit-code
//    docs/BUSINESS-CHAIN.md` + unit drift-gate, ki primerja commitano
//    datoteko z buildBusinessChainDoc()).
//
// Dokumenta NE urejati ročno — spremeni FACTS in regeneriraj.
//
// Zaženi: bun run chain   (= npx tsx scripts/generate-business-chain.ts)
// ============================================

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MODULE_REGISTRY } from '../src/lib/modules/registry'

// ── Tipi ────────────────────────────────────────────────────────────

/** Posamezno dejstvo poslovne verige (zrcali ValidationCapability iz §8). */
export interface BusinessFact {
  id: string
  label: string
  /** true = ena od 11 vrstic iz epika §10; false = razširitev po realni kodi. */
  epic10: boolean
  /** Prisma modeli — MORAJO obstajati v prisma/schema.prisma (^model X). */
  models: string[]
  /** Writer poti (route/helper fajli) — MORAJO obstajati na disku. */
  writers: string[]
  /** Reader poti (route fajli) — MORAJO obstajati na disku. */
  readers: string[]
  /** §6 registry moduleIds — MORAJO obstajati v MODULE_REGISTRY. */
  modules: string[]
  /** Izpeljane vrednosti + izvor datoteke (prosto besedilo s `pot` refs). */
  derived: string
  /** AuditLog action strings — MORAJO se pojaviti v src scanu (fail-closed). */
  auditActions: string[]
  /** Če audit NI na voljo ali je ledger = sled — izrecno zabeleženo. */
  auditNote?: string
}

// ── Dejstva (11 iz epika §10 + 3 razširitve po realni kodi) ─────────

export const FACTS: BusinessFact[] = [
  // ══ 11 vrstic iz epika #144 §10 ══
  {
    id: 'menu-item',
    label: 'Meni item / katalog',
    epic10: true,
    models: ['Menu', 'MenuItem', 'Category'],
    writers: [
      'src/app/api/menus/route.ts',
      'src/app/api/menus/[id]/route.ts',
      'src/app/api/categories/route.ts',
      'src/app/api/categories/[id]/route.ts',
      'src/app/api/menu-items/route.ts',
      'src/app/api/menu-items/[id]/route.ts',
      'src/app/api/menu-items/bulk-import/route.ts',
      'src/app/api/menu-items/bulk-vat/route.ts',
      'src/app/api/modifier-groups/route.ts',
      'src/lib/onboarding/catalog-templates/apply-starter-catalog.ts',
    ],
    readers: [
      'src/app/api/menu-items/route.ts',
      'src/app/api/public/menu/route.ts',
      'src/app/api/mobile/menu/route.ts',
      'src/app/api/public/availability/route.ts',
    ],
    modules: ['menu', 'orders', 'kitchen', 'recipes', 'food-cost'],
    derived:
      'Sold-out NI persistiran — branje-ob-času kanon `src/lib/availability/menu-availability.ts` (computeMenuStockMap: isAvailable flag + zaloga → sold_out/unavailable/limited/in_stock, R124); uveljavljanje ob naročilu `src/app/api/orders/_helpers/post-handler.ts` (409 + soldOutItems)',
    auditActions: [],
    auditNote:
      'NI AuditLog akcij za meni CRUD (izrecno zabeleženo); DELETE = soft-delete (isAvailable:false), katalog ima lastno sledljivost prek DB vrstic',
  },
  {
    id: 'price',
    label: 'Cena',
    epic10: true,
    models: ['MenuItem', 'OrderItem', 'OrderItemModifier'],
    writers: [
      'src/app/api/menu-items/route.ts',
      'src/app/api/menu-items/[id]/route.ts',
      'src/app/api/menu-items/bulk-vat/route.ts',
      'src/app/api/orders/_helpers/order-items.ts',
      'src/app/api/orders/[id]/_helpers/order-mutations.ts',
    ],
    readers: ['src/app/api/public/menu/route.ts', 'src/app/api/menu-items/route.ts'],
    modules: ['menu', 'orders', 'reports'],
    derived:
      'OrderItem.price/vatRate/vatAmount/menuItemName = server-avtoritativni snapshot ob naročilu (`buildOrderItemsData` — cena iz DB MenuItem.price, FIX BUG-13; client cene NIKOLI zaupane); PriceGroup NE nosi cene (samo grupiranje); ni menu versioning modela',
    auditActions: [],
    auditNote:
      'sprememba MenuItem.price nima namenske audit akcije (izrecno zabeleženo kot vrzel v registru tveganj — P1 kandidat)',
  },
  {
    id: 'recipe',
    label: 'Recept / normativ',
    epic10: true,
    models: ['RecipeItem', 'BatchPreparation', 'BatchPreparationLine'],
    writers: [
      'src/app/api/recipes/route.ts',
      'src/app/api/batch-preparations/route.ts',
      'src/app/api/batch-preparations/[id]/complete/route.ts',
      'src/app/api/batch-preparations/_helpers/batch-preparation-mutations.ts',
    ],
    readers: [
      'src/app/api/recipes/route.ts',
      'src/app/api/food-cost/route.ts',
      'src/app/api/inventory/menu-stock/route.ts',
    ],
    modules: ['recipes', 'food-cost', 'kitchen-prep', 'recipe-scaling'],
    derived:
      'food cost = Σ(rawFromUsable(quantityPerServing, yieldPercent) × costPerServing) — `src/app/api/food-cost/route.ts`; RecipeItem visi direktno na MenuItem (brez samostojnega Recipe modela); sub-recepti = BatchPreparation (outputCostPerUnit = Σinput/output)',
    auditActions: ['BATCHPREP_CREATE', 'BATCHPREP_COMPLETE'],
    auditNote: 'recept CRUD brez audit akcij; batch preparation ima BATCHPREP_*',
  },
  {
    id: 'stock',
    label: 'Zaloga (ledger)',
    epic10: true,
    models: ['InventoryItem', 'StockTransaction', 'InventoryBatch', 'StockBatchAllocation'],
    writers: [
      'src/app/api/inventory/_helpers/stock-mutations.ts',
      'src/app/api/waste/_helpers/waste-mutations.ts',
      'src/app/api/stocktakes/_helpers/stocktake-mutations.ts',
      'src/app/api/batch-preparations/_helpers/batch-preparation-mutations.ts',
      'src/lib/stock-deduction/deduct-recipe.ts',
      'src/lib/stock-deduction/return-stock.ts',
      'src/app/api/purchase-orders/[id]/_helpers.ts',
      'src/app/api/inventory/reorder/_helpers/create-order.ts',
      'src/app/api/inventory/transactions/route.ts',
      'src/app/api/order-items/[id]/_helpers/void-stock-return.ts',
    ],
    readers: [
      'src/app/api/inventory/route.ts',
      'src/app/api/inventory/transactions/route.ts',
      'src/app/api/inventory/menu-stock/route.ts',
      'src/app/api/inventory/batches/route.ts',
    ],
    modules: ['inventory', 'inventory-alerts', 'reorder-center', 'waste-tracker'],
    derived:
      "InventoryBatch/StockBatchAllocation = SLEDLJIVOSTNA PROJEKCIJA (schema komentar L1272–1278): InventoryItem.quantity + StockTransaction sta EDINA source of truth; sale deduction = CAS `updateMany where quantity >= qty` (`src/lib/stock-deduction/deduct-*`); R106 kanon: vse per-item absolutne mutacije pod `pg_advisory_xact_lock(hashtext('inv-stock:<itemId>'))` — R180: ročna transakcija (transactions POST) ZADNJA migrirana pot",
    auditActions: ['INVENTORY_ADJUST', 'AUTO_CANCEL_INSUFFICIENT_STOCK'],
    auditNote:
      'večina premikov NIMA audit akcije — StockTransaction ledger vrstica JE revizijska sled (previousQty→newQty veriga)',
  },
  {
    id: 'waste',
    label: 'Odpis / šoda',
    epic10: true,
    models: ['WasteRecord'],
    writers: [
      'src/app/api/waste/route.ts',
      'src/app/api/waste/_helpers/waste-mutations.ts',
      'src/app/api/waste/[id]/reverse/route.ts',
    ],
    readers: ['src/app/api/waste/route.ts'],
    modules: ['waste-tracker', 'food-cost'],
    derived:
      "totalCost = quantity × costPerUnit snapshot (food-cost vir); reverse = kompenzacijski 'return' ledger zapis, ledger vrstica NIKOLI izbrisana",
    auditActions: ['WASTE_CREATE', 'WASTE_REVERSE'],
  },
  {
    id: 'purchase',
    label: 'Nabava / PO',
    epic10: true,
    models: ['PurchaseOrder', 'PurchaseOrderItem', 'GoodsReceipt', 'GoodsReceiptItem', 'ReorderRule'],
    writers: [
      'src/app/api/purchase-orders/route.ts',
      'src/app/api/purchase-orders/[id]/route.ts',
      'src/app/api/purchase-orders/[id]/_helpers.ts',
      'src/app/api/purchase-orders/[id]/receive/route.ts',
      'src/app/api/purchase-orders/[id]/invoice/route.ts',
      'src/app/api/reorder/draft-po/route.ts',
      'src/lib/predictive-ordering/index.ts',
    ],
    readers: [
      'src/app/api/purchase-orders/route.ts',
      'src/app/api/purchase-orders/[id]/invoice/route.ts',
      'src/app/api/reports/ap-aging/route.ts',
      'src/app/api/inventory/reorder/route.ts',
    ],
    modules: ['reorder-center', 'suppliers', 'vendor-scorecard'],
    derived:
      'PurchaseOrderItem.quantityReceived/quantityRejected kumulativi; PO.status partial/received; PO.invoiceStatus none|partial|invoiced|variance (three-way match PO↔GRN↔račun); AccountsPayable.matchStatus; pack→base konverzija per PurchaseOrderItem.packQty snapshot',
    auditActions: ['PURCHASE_ORDER_RECEIVED', 'SUPPLIER_INVOICE_RECORDED'],
  },
  {
    id: 'supplier',
    label: 'Dobavitelj',
    epic10: true,
    models: ['Supplier', 'SupplierItem', 'SupplierPriceHistory'],
    writers: [
      'src/app/api/suppliers/route.ts',
      'src/app/api/suppliers/[id]/route.ts',
      'src/app/api/suppliers/[id]/catalog/route.ts',
      'src/app/api/inventory/price-history/route.ts',
    ],
    readers: [
      'src/app/api/suppliers/route.ts',
      'src/app/api/suppliers/[id]/scorecard/route.ts',
      'src/app/api/inventory/price-history/route.ts',
    ],
    modules: ['suppliers', 'vendor-scorecard'],
    derived:
      'SupplierPriceHistory (source goods_receipt | manual); NAPOVED: InventoryItem.supplier legacy free-text + SupplierItem FK = vzporedna referenca (tveganje A-risk v registru)',
    auditActions: ['SUPPLIER_CATALOG_UPSERT', 'SUPPLIER_CATALOG_DELETE', 'SUPPLIER_PRICE_MANUAL'],
  },
  {
    id: 'order',
    label: 'Naročilo',
    epic10: true,
    models: ['Order', 'OrderItem', 'OrderItemModifier', 'Check'],
    writers: [
      'src/app/api/orders/route.ts',
      'src/app/api/orders/_helpers/post-handler.ts',
      'src/app/api/orders/[id]/add-items/route.ts',
      'src/app/api/orders/[id]/_helpers/put-handler.ts',
      'src/app/api/order-items/[id]/route.ts',
      'src/app/api/tables/_helpers/table-ops.ts',
      'src/app/api/public/kiosk/route.ts',
      'src/app/api/public/order/route.ts',
      'src/app/api/public/online-order/_helpers/create-order.ts',
      'src/app/api/mobile/order/route.ts',
    ],
    readers: [
      'src/app/api/orders/[id]/route.ts',
      'src/app/api/kitchen/route.ts',
      'src/app/api/dashboard/route.ts',
      'src/app/api/reports/sales/route.ts',
    ],
    modules: ['orders', 'kitchen', 'tables', 'floor-plan', 'danes'],
    derived:
      'Order/Check totals iz OrderItem vrstic; paymentStatus/paidAt (agregat čez payments — `src/app/api/payments/_helpers/check-status.ts`); firedAt (R115); readyAt/readyById/readyByName (KDS bump, R133); inventoryDeducted claim flag (P1-19); orderNumber per-location atomarni števec (`src/lib/counters.ts`); Check = plačljiva podmnožica OrderItemov (Toast-stil dvojna hramba — tveganje A3)',
    auditActions: [
      'CREATE_ORDER',
      'ADD_ITEMS_TO_ORDER',
      'UPDATE_ORDER_STATUS',
      'CANCEL_ORDER',
      'VOID_ORDER_ITEM',
      'ORDER_TABLE_TRANSFER',
      'COURSE_FIRE',
      'TABLE_MERGE',
    ],
  },
  {
    id: 'payment',
    label: 'Plačilo',
    epic10: true,
    models: ['Payment', 'Check'],
    writers: [
      'src/app/api/payments/route.ts',
      'src/app/api/payments/_helpers/create-payment.ts',
      'src/app/api/payments/[id]/route.ts',
      'src/app/api/payments/[id]/refund/route.ts',
      'src/app/api/qr-pay/confirm/route.ts',
    ],
    readers: ['src/app/api/payments/route.ts', 'src/app/api/cash-register/route.ts'],
    modules: ['cash-register', 'wallet-payment', 'gift-cards', 'loyalty'],
    derived:
      'Check.paymentStatus/paidAt/Order.status completed — derivacija iz agregata completanih payments; LoyaltyAccount.pointsBalance + GiftCard.balance (+ledger balanceAfter); idempotency kanon: `@@unique([locationId, idempotencyKey])` + P2002 replay = isti payment (R116)',
    auditActions: ['CREATE_PAYMENT', 'UPDATE_PAYMENT', 'REFUND_PAYMENT', 'QR_PAY_PAYMENT'],
    auditNote:
      'R180: UPDATE_PAYMENT (PUT /api/payments/[id]) in QR_PAY_PAYMENT preklopljeni iz direktenga db.auditLog.create na createAuditLog hash-chain kanon (prej 2 izjemi brez verige — tveganje A8 rešeno)',
  },
  {
    id: 'receipt',
    label: 'Račun / fiskalizacija',
    epic10: true,
    models: ['Receipt'],
    writers: [
      'src/app/api/receipts/[id]/route.ts',
      'src/app/api/receipts/[id]/_helpers/post-handler.ts',
      'src/app/api/furs/helpers/verify-invoice/post-verify.ts',
      'src/lib/outbox/processors/furs.ts',
      'src/app/api/furs/helpers/storno-invoice/storno-transaction.ts',
      'src/lib/cis/receipt-submission.ts',
    ],
    readers: [
      'src/app/api/receipts/[id]/route.ts',
      'src/app/api/digital-receipt/route.ts',
      'src/app/api/furs/e-invoice-book/route.ts',
    ],
    modules: ['furs', 'z-report', 'reports'],
    derived:
      'VAT breakdown snapshot ob izdaji (`calculateVatBreakdownForReceipt`); per-location številčenje (getNextReceiptNumber); zoi/eor/fiscalVerified pisci: sync verify + batch + async outbox (outbox skipa če eor že obstaja); FURS QR iz zoi+total+taxId',
    auditActions: ['FURS_VERIFY_SUCCESS', 'FURS_VERIFY_FAILED', 'FURS_BATCH_VERIFY', 'FURS_STORNO'],
  },
  {
    id: 'customer',
    label: 'Gost / zvestoba',
    epic10: true,
    models: ['Guest', 'GuestVisit', 'Reservation', 'LoyaltyAccount'],
    writers: [
      'src/app/api/guests/route.ts',
      'src/app/api/guests/[id]/route.ts',
      'src/app/api/guests/[id]/visits/route.ts',
      'src/lib/guest-visit-chain.ts',
      'src/app/api/reservations/_helpers/create-handler.ts',
      'src/app/api/loyalty/[id]/route.ts',
    ],
    readers: [
      'src/app/api/guests/route.ts',
      'src/app/api/reservations/route.ts',
      'src/app/api/loyalty/route.ts',
    ],
    modules: ['guests', 'reservations', 'loyalty', 'waitlist', 'customer-timeline'],
    derived:
      'pointsBalance/tier iz LoyaltyTransaction ledger + `src/lib/loyalty-tiers.ts`; GuestVisit chain = hash-veriga (analogno AuditLog); točkovne mutacije pod `updateLoyaltyAccountWithLock` lock-om',
    auditActions: ['CREATE_RESERVATION', 'CANCEL_RESERVATION', 'GIFT_CARD_CREATED'],
    auditNote:
      'loyalty točke brez namenske audit akcije — LoyaltyTransaction ledger JE sled; GuestVisit chain ima lastno hash integriteto (/api/audit/guest-visit-integrity)',
  },
  // ══ Razširitve po realni kodi (epik §10: razširi verigo na preostale ključne entitete) ══
  {
    id: 'cash-shift',
    label: 'Smena / Z-poročilo / EOD',
    epic10: false,
    models: ['CashRegisterShift', 'ZReport', 'DailyClose'],
    writers: [
      'src/app/api/cash-register/route.ts',
      'src/app/api/cash-register/[id]/route.ts',
      'src/app/api/end-of-day/_helpers/close-shift.ts',
      'src/app/api/reports/eod/_helpers/eod-close.ts',
      'src/app/api/z-report/_helpers/upsert-z-report.ts',
      'src/app/api/daily-close/route.ts',
    ],
    readers: [
      'src/app/api/cash-register/route.ts',
      'src/app/api/z-report/route.ts',
      'src/app/api/reports/eod/route.ts',
    ],
    modules: ['cash-register', 'end-of-day', 'z-report', 'shifts'],
    derived:
      "shift totals (cashSales/cardSales/totalSales/cashDifference); Z totals — R110 kanon: vsi Z-pisi skozi EN upsert pod `pg_advisory_xact_lock(hashtext('z-report:<loc>:<date>'))` + CAS `{ status: { not: 'finalized' } }`; Z-poročilo = EDINI vir finančne resnice (§18); DailyClose = snapshot pariteta",
    auditActions: ['CLOSE_REGISTER_SHIFT', 'EOD_COMPLETED', 'DAILY_CLOSE_APPROVED', 'Z_REPORT_REOPENED'],
  },
  {
    id: 'stocktake',
    label: 'Inventura',
    epic10: false,
    models: ['Stocktake', 'StocktakeItem'],
    writers: [
      'src/app/api/stocktakes/route.ts',
      'src/app/api/stocktakes/[id]/approve/route.ts',
      'src/app/api/stocktakes/_helpers/stocktake-mutations.ts',
    ],
    readers: ['src/app/api/stocktakes/route.ts'],
    modules: ['inventory'],
    derived:
      'expectedQuantity/countedQuantity/varianceQuantity/varianceValue = snapshoti ZA PREGLED; avtoritativni popravek = povezana StockTransaction vrstica (schema komentar L1416–1419); double-approve = updateMany status claim guard',
    auditActions: ['STOCKTAKE_CREATE', 'STOCKTAKE_APPROVE'],
  },
  {
    id: 'audit-infra',
    label: 'Audit log (infrastruktura)',
    epic10: false,
    models: ['AuditLog'],
    writers: ['src/lib/db.ts'],
    readers: [
      'src/app/api/audit/route.ts',
      'src/app/api/audit/verify-chain/route.ts',
      'src/app/api/audit/archive/route.ts',
    ],
    modules: ['audit-log', 'compliance'],
    derived:
      'SHA-256 hash veriga (previousHash|action|entityType|entityId|userId|details → chainHash); locationId samodejno izpeljan (R81); createAuditLog = EDINI pisalni kanon od R180 (2 direktni izjemi migrirani); retention/archive delete = audited (AUDIT_RETENTION_PURGED)',
    auditActions: ['AUDIT_CHAIN_VERIFIED', 'AUDIT_RETENTION_PURGED'],
  },
]

// ── Validacija (fail-closed) ────────────────────────────────────────

const REPO = process.cwd()

/** En-pass scan vseh src .ts/.tsx datotek (za audit akcije). */
function collectSrcSource(): string {
  const parts: string[] = []
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e)
      const st = statSync(p)
      if (st.isDirectory()) walk(p)
      else if (/\.(ts|tsx)$/.test(e)) parts.push(readFileSync(p, 'utf-8'))
    }
  }
  walk(join(REPO, 'src'))
  return parts.join('\n')
}

function validateFacts(): void {
  const registryIds = new Set(MODULE_REGISTRY.map((m) => m.id))
  const schema = readFileSync(join(REPO, 'prisma', 'schema.prisma'), 'utf-8')
  const srcSource = collectSrcSource()
  const errors: string[] = []

  for (const f of FACTS) {
    for (const model of f.models) {
      if (!new RegExp(`^model ${model}\\b`, 'm').test(schema)) {
        errors.push(`${f.id}: Prisma model "${model}" NE OBSTAJA v prisma/schema.prisma`)
      }
    }
    for (const w of f.writers) {
      if (!existsSync(join(REPO, w))) errors.push(`${f.id}: writer pot NE OBSTAJA: ${w}`)
    }
    for (const r of f.readers) {
      if (!existsSync(join(REPO, r))) errors.push(`${f.id}: reader pot NE OBSTAJA: ${r}`)
    }
    for (const mid of f.modules) {
      if (!registryIds.has(mid)) {
        errors.push(`${f.id}: moduleId "${mid}" ne obstaja v §6 registerju`)
      }
    }
    for (const action of f.auditActions) {
      if (!srcSource.includes(action)) {
        errors.push(`${f.id}: audit akcija "${action}" NI najdena v src/**/*.{ts,tsx} scanu`)
      }
    }
    if (f.models.length === 0 || f.writers.length === 0 || f.readers.length === 0) {
      errors.push(`${f.id}: fail-closed — vsaj 1 model + 1 writer + 1 reader je obvezen`)
    }
  }

  if (errors.length > 0) {
    throw new Error(`BUSINESS-CHAIN sidra niso veljavna:\n${errors.join('\n')}`)
  }
}

// ── Dokument ────────────────────────────────────────────────────────

/** Escapa markdown tabelno celico (pipe + nove vrstice). */
const cell = (s: string): string => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')

export function buildBusinessChainDoc(): string {
  validateFacts()

  const epic10Facts = FACTS.filter((f) => f.epic10)
  const expansionFacts = FACTS.filter((f) => !f.epic10)
  const totalModels = new Set(FACTS.flatMap((f) => f.models)).size
  const totalWriters = new Set(FACTS.flatMap((f) => f.writers)).size
  const totalReaders = new Set(FACTS.flatMap((f) => f.readers)).size
  const totalAuditActions = new Set(FACTS.flatMap((f) => f.auditActions)).size

  const lines: string[] = []
  const poti = (n: number): string => (n === 1 ? 'pot' : 'poti')

  lines.push('# BUSINESS-CHAIN (§10)')
  lines.push('')
  lines.push(
    '> ⚙️ GENERIRANO z `scripts/generate-business-chain.ts` (bun run chain, epik #144 §10, R180) — **NE urejati ročno**.',
  )
  lines.push(
    '> Epik #144 §10 "Business-chain verification": *Validate the full data chain: **menu → recipe → order → KDS → stock → waste → procurement → supplier → cost → finance/reporting***.',
  )
  lines.push(
    '> Načelo: za vsako ključno entiteto je dokumentirana veriga **source of truth → writers → readers → derived values → audit**.',
  )
  lines.push('')

  lines.push(
    `**${FACTS.length} dejstev** (${epic10Facts.length} iz epika §10 + ${expansionFacts.length} razširitev po realni kodi) · ` +
      `${totalModels} Prisma modelov · ${totalWriters} writer poti · ${totalReaders} reader poti · ` +
      `${totalAuditActions} audit akcij · 0 trditev produkcijske validacije`,
  )
  lines.push('')

  lines.push('| Dejstvo | Source of truth (Prisma) | Writers | Readers | Derived values | Audit |')
  lines.push('|---|---|---|---|---|---|')
  for (const f of FACTS) {
    const name = `\`${f.id}\` ${f.label}${f.epic10 ? '' : ' (razširitev)'}`
    const models = f.models.map((m) => `\`${m}\``).join(', ')
    const writers = `${f.writers.length} ${poti(f.writers.length)} (\`${f.modules.join('`, `')}\`)`
    const readers = `${f.readers.length} ${poti(f.readers.length)}`
    const audit = f.auditActions.length > 0 ? `${f.auditActions.length}` : '—'
    lines.push(`| ${cell(name)} | ${cell(models)} | ${cell(writers)} | ${cell(readers)} | ${cell(f.derived)} | ${audit} |`)
  }
  lines.push('')

  lines.push('## Dejstva po virih (vsak zapis = fail-closed preverjeno ob generaciji)')
  lines.push('')
  for (const f of FACTS) {
    const mods = ` · §6 moduli: \`${f.modules.join('`, `')}\``
    lines.push(`### \`${f.id}\` — ${f.label}${f.epic10 ? '' : ' (razširitev)'}${mods}`)
    lines.push('')
    lines.push(
      '- **Source of truth (Prisma)**: ' + f.models.map((m) => `\`${m}\``).join(', '),
    )
    lines.push('- **Writers (' + f.writers.length + ')**: ' + f.writers.map((w) => `\`${w}\``).join(', '))
    lines.push('- **Readers (' + f.readers.length + ')**: ' + f.readers.map((r) => `\`${r}\``).join(', '))
    lines.push(`- **Derived values**: ${f.derived}`)
    if (f.auditActions.length > 0) {
      lines.push('- **Audit akcije**: ' + f.auditActions.map((a) => `\`${a}\``).join(', '))
    } else {
      lines.push('- **Audit**: — (brez namenskih AuditLog akcij)')
    }
    if (f.auditNote) lines.push(`- **Opomba**: ${f.auditNote}`)
    lines.push('')
  }

  lines.push('## Registri arhitekturnih tveganj (A0–A9)')
  lines.push('')
  lines.push(
    '- **A0 LEDGER PRINCIP (deklarirano)**: StockTransaction + InventoryItem.quantity = edini vir resnice za zalogo; Batch/Allocation/Waste/Check snapshoti = projekcije. Vse per-item absolutne mutacije na skupnem ključu `inv-stock:<itemId>` (R106) — od R182 brez izjem (A2 rešen: prevzem/prodaja/vračilo na istem ključu).',
  )
  lines.push(
    '- **A1 🔴→✅ REŠENO R180**: POST /api/inventory/transactions je bil zadnja nekanonizirana pot (stale read izven tx + nepogojen absolutni set + silent clamp-to-0 — INV-1/INV-2 družina). Migrirano na R106 kanon (`createManualStockTransaction`): skupni lock + tx-fresh re-read + pogojni decrement (fail-closed 400 namesto clamp-a) + FEFO batch poraba. Drift-gate pini novo stanje.',
  )
  lines.push(
    "- **A2 ✅→REŠENO R182 (enoten inv-stock lock kanon)**: trije zalogovni pisalni tokovi so mutirali InventoryItem.quantity MIMO R106 ključa — PO receive je ključaval samo `hashtext(poId)`, return-stock samo `stock-return:<orderId>`, sale deduction sploh brez ključavnice (samo CAS claim + pogojni decrement). Cross-domena sočasnost (prodaja ∥ odpis, vračilo ∥ prevzem) se NI serializirala na artiklu → preplet StockTransaction revizijskih vrstic (previousQty → newQty ni bil brezvsnežna veriga) + SSI abort-noise. R182: `acquireInvStockLocks` (src/lib/stock-deduction/locks.ts — sortirano, dedup, listi grafa za entitetnima ključavnica order-write/stock-return/poId, null-safe) v VSEH treh tokovih: deduct-order (pre-pass resolucija artiklov zrcali deduct-recipe/deduct-direct resolucijo, ključavnice po CAS claimu, pred mutacijami), return-stock (snapshot pot + legacy pot) in PO receive (po poId ključavnici, pred item zanko); stock-mutations re-export = enoten vir ključa. Brez izolacijskih sprememb — pisalna izključitev = advisory lock; pogojni updateMany (gte) ostane obrambna globina (Serializable na vroči prodajni poti bi DODAL P2034 retry-noise — nasprotno cilju A2). Drift-gate: tests/unit/security/r182-stock-lock-canon.test.ts (13 testov: runtime red claim→locks→mutacije, izgubljen claim = no-op, helper enota sort/dedup/null, fs-pini + negativni pini divergenc).",
  )
  lines.push(
    '- **A3 ✅→REŠENO R181 (CK-5)** Order totals vs Check totals — dvojna hramba po zasnovi (Toast-stil checks = plačljive podmnožice), reizračun iz istih OrderItem vrstic. NEKOČ ŠIBKA TOČKA: `recalculateAffectedChecks` je deloval read-modify-write na golem clientu BREZ tx/ključavnice (vzorec, ki ga je R109 popravil na void poti). CK-5 kanon: create + link + recalc (preimenovan v `recalculateAffectedChecksInTx`) VSE v enem $transaction(Serializable) pod advisory locks v fiksnem vrstnem redu (`order-write:`+orderId → sorted raw checkId, enaka ključa kot R109/R108 in plačilne poti) + tx-fresh re-read naročila/artiklov + tx-fresh guard proti plačanim čekom + CAS updateMany (paymentStatus not paid). Drift-gate: tests/unit/security/r181-checks-post-kanon.test.ts (14 testov, vključno z negativnimi pini starega db-client vzorca).',
  )
  lines.push(
    '- **A4 ✅ Cena** — legitimni snapshot, NI drugega neodvisno mutabilnega vira: MenuItem.price edini mutable; OrderItem.price server-computed enkrat ob naročilu; client cene nikoli zaupane; PriceGroup ne nosi cene.',
  )
  lines.push(
    '- **A5 ✅ Sold-out** — deriviran, NI persistiran: read-time kanon (`menu-availability.ts`) + uveljavljanje ob naročilu (R124 409); `MenuItem.isAvailable` = ročni 86-flag z enim pisalcem.',
  )
  lines.push(
    "- **A6 🟡 Trojni pisec smene/Z** — 3 rute zaprejo smeno (cash-register/[id], end-of-day, reports/eod), vse CAS `updateMany {status:'open'}` + vse Z-pise skozi EN R110 upsert z ključavnico. Urejena multiplikativnost — sprejemljivo, občutljivo na drift.",
  )
  lines.push(
    '- **A7 🟡 Derivacija plačilnega statusa podvojena**: kanon v `check-status.ts`, ampak qr-pay/kiosk/refund re-implementirajo dele tranzicij inline; refund direktno prevrača loyalty/giftcard balance (z ledger vrsticami ob strani). Drift tveganje, ne korupcija.',
  )
  lines.push(
    '- **A8 🔴→✅ REŠENO R180**: 2 direktni `db.auditLog.create` brez hash verige (payments/[id] UPDATE_PAYMENT, qr-pay/confirm QR_PAY_PAYMENT) → migrirano na `createAuditLog` kanon (SHA-256 veriga). Drift-gate pini odsotnost direktenga pisanja v teh dveh datotekah.',
  )
  lines.push(
    '- **A9 ✅ AuditLog sam** — enoten helper s hash verigo; direktne izjeme = A8 (rešeno R180); retention/anonymization delete = namenski + audited.',
  )
  lines.push('')

  lines.push('## Legenda / Anti-overclaim')
  lines.push('')
  lines.push(
    '- Ta dokument = **strukturna verifikacija kode** (fail-closed sidra na realne datoteke, modele, §6 module in audit akcije) — **NE produkcijska validacija**. Kritično pravilo epika #144 §8 velja tudi tu: zelen CI NI isto kot produkcijska validacija (dokazni kanali = VALIDATION-MATRIX §8).',
  )
  lines.push(
    '- **Ledger princip**: kjer opomba pravi "ledger JE sled" (StockTransaction / LoyaltyTransaction / GiftCardTransaction / GuestVisit chain), je revizijska sled DB vrstica s prej/potem ali hash-verigo — namenski AuditLog akciji ni treba obstajati, ampak mora biti to IZRECNO zabeleženo (nikoli tiho).',
  )
  lines.push(
    '- **Audit brez akcij = izrecno zabeleženo**: vsaka vrzel ima `Opomba` v anchor sekciji; noben `—` v stolpcu Audit ni implicitna trditev pokritosti.',
  )
  lines.push(
    '- Vsak ✓/sidro zahteva NOV dokaz (realna datoteka / akcija v src scanu); brisanje ali preimenovanje sidra = fail-closed napaka ob generaciji + rdeč drift-gate.',
  )
  lines.push('')

  return lines.join('\n')
}

// ── Pisanje (samo pri direktnem zagonu, ne pri importu iz testov) ───

const OUT = join(REPO, 'docs', 'BUSINESS-CHAIN.md')
const isDirectRun =
  typeof process !== 'undefined' &&
  typeof process.argv[1] === 'string' &&
  process.argv[1].replace(/\\/g, '/').includes('generate-business-chain')

if (isDirectRun) {
  writeFileSync(OUT, buildBusinessChainDoc(), 'utf-8')
  console.log(
    `[business-chain] docs/BUSINESS-CHAIN.md regeneriran (${FACTS.length} dejstev, ${FACTS.filter((f) => f.epic10).length} epik §10 + ${FACTS.filter((f) => !f.epic10).length} razširitev).`,
  )
}
