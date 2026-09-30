# BUSINESS-CHAIN (§10)

> ⚙️ GENERIRANO z `scripts/generate-business-chain.ts` (bun run chain, epik #144 §10, R180) — **NE urejati ročno**.
> Epik #144 §10 "Business-chain verification": *Validate the full data chain: **menu → recipe → order → KDS → stock → waste → procurement → supplier → cost → finance/reporting***.
> Načelo: za vsako ključno entiteto je dokumentirana veriga **source of truth → writers → readers → derived values → audit**.

**14 dejstev** (11 iz epika §10 + 3 razširitev po realni kodi) · 35 Prisma modelov · 73 writer poti · 36 reader poti · 38 audit akcij · 0 trditev produkcijske validacije

| Dejstvo | Source of truth (Prisma) | Writers | Readers | Derived values | Audit |
|---|---|---|---|---|---|
| `menu-item` Meni item / katalog | `Menu`, `MenuItem`, `Category` | 10 poti (`menu`, `orders`, `kitchen`, `recipes`, `food-cost`) | 4 poti | Sold-out NI persistiran — branje-ob-času kanon `src/lib/availability/menu-availability.ts` (computeMenuStockMap: isAvailable flag + zaloga → sold_out/unavailable/limited/in_stock, R124); uveljavljanje ob naročilu `src/app/api/orders/_helpers/post-handler.ts` (409 + soldOutItems) | — |
| `price` Cena | `MenuItem`, `OrderItem`, `OrderItemModifier` | 5 poti (`menu`, `orders`, `reports`) | 2 poti | OrderItem.price/vatRate/vatAmount/menuItemName = server-avtoritativni snapshot ob naročilu (`buildOrderItemsData` — cena iz DB MenuItem.price, FIX BUG-13; client cene NIKOLI zaupane); PriceGroup NE nosi cene (samo grupiranje); ni menu versioning modela | — |
| `recipe` Recept / normativ | `RecipeItem`, `BatchPreparation`, `BatchPreparationLine` | 4 poti (`recipes`, `food-cost`, `kitchen-prep`, `recipe-scaling`) | 3 poti | food cost = Σ(rawFromUsable(quantityPerServing, yieldPercent) × costPerServing) — `src/app/api/food-cost/route.ts`; RecipeItem visi direktno na MenuItem (brez samostojnega Recipe modela); sub-recepti = BatchPreparation (outputCostPerUnit = Σinput/output) | 2 |
| `stock` Zaloga (ledger) | `InventoryItem`, `StockTransaction`, `InventoryBatch`, `StockBatchAllocation` | 10 poti (`inventory`, `inventory-alerts`, `reorder-center`, `waste-tracker`) | 4 poti | InventoryBatch/StockBatchAllocation = SLEDLJIVOSTNA PROJEKCIJA (schema komentar L1272–1278): InventoryItem.quantity + StockTransaction sta EDINA source of truth; sale deduction = CAS `updateMany where quantity >= qty` (`src/lib/stock-deduction/deduct-*`); R106 kanon: vse per-item absolutne mutacije pod `pg_advisory_xact_lock(hashtext('inv-stock:<itemId>'))` — R180: ročna transakcija (transactions POST) ZADNJA migrirana pot | 2 |
| `waste` Odpis / šoda | `WasteRecord` | 3 poti (`waste-tracker`, `food-cost`) | 1 pot | totalCost = quantity × costPerUnit snapshot (food-cost vir); reverse = kompenzacijski 'return' ledger zapis, ledger vrstica NIKOLI izbrisana | 2 |
| `purchase` Nabava / PO | `PurchaseOrder`, `PurchaseOrderItem`, `GoodsReceipt`, `GoodsReceiptItem`, `ReorderRule` | 7 poti (`reorder-center`, `suppliers`, `vendor-scorecard`) | 4 poti | PurchaseOrderItem.quantityReceived/quantityRejected kumulativi; PO.status partial/received; PO.invoiceStatus none\|partial\|invoiced\|variance (three-way match PO↔GRN↔račun); AccountsPayable.matchStatus; pack→base konverzija per PurchaseOrderItem.packQty snapshot | 2 |
| `supplier` Dobavitelj | `Supplier`, `SupplierItem`, `SupplierPriceHistory` | 4 poti (`suppliers`, `vendor-scorecard`) | 3 poti | SupplierPriceHistory (source goods_receipt \| manual); NAPOVED: InventoryItem.supplier legacy free-text + SupplierItem FK = vzporedna referenca (tveganje A-risk v registru) | 3 |
| `order` Naročilo | `Order`, `OrderItem`, `OrderItemModifier`, `Check` | 10 poti (`orders`, `kitchen`, `tables`, `floor-plan`, `danes`) | 4 poti | Order/Check totals iz OrderItem vrstic; paymentStatus/paidAt (agregat čez payments — `src/app/api/payments/_helpers/check-status.ts`); firedAt (R115); readyAt/readyById/readyByName (KDS bump, R133); inventoryDeducted claim flag (P1-19); orderNumber per-location atomarni števec (`src/lib/counters.ts`); Check = plačljiva podmnožica OrderItemov (Toast-stil dvojna hramba — tveganje A3) | 8 |
| `payment` Plačilo | `Payment`, `Check` | 5 poti (`cash-register`, `wallet-payment`, `gift-cards`, `loyalty`) | 2 poti | Check.paymentStatus/paidAt/Order.status completed — derivacija iz agregata completanih payments; LoyaltyAccount.pointsBalance + GiftCard.balance (+ledger balanceAfter); idempotency kanon: `@@unique([locationId, idempotencyKey])` + P2002 replay = isti payment (R116) | 4 |
| `receipt` Račun / fiskalizacija | `Receipt` | 6 poti (`furs`, `z-report`, `reports`) | 3 poti | VAT breakdown snapshot ob izdaji (`calculateVatBreakdownForReceipt`); per-location številčenje (getNextReceiptNumber); zoi/eor/fiscalVerified pisci: sync verify + batch + async outbox (outbox skipa če eor že obstaja); FURS QR iz zoi+total+taxId | 4 |
| `customer` Gost / zvestoba | `Guest`, `GuestVisit`, `Reservation`, `LoyaltyAccount` | 6 poti (`guests`, `reservations`, `loyalty`, `waitlist`, `customer-timeline`) | 3 poti | pointsBalance/tier iz LoyaltyTransaction ledger + `src/lib/loyalty-tiers.ts`; GuestVisit chain = hash-veriga (analogno AuditLog); točkovne mutacije pod `updateLoyaltyAccountWithLock` lock-om | 3 |
| `cash-shift` Smena / Z-poročilo / EOD (razširitev) | `CashRegisterShift`, `ZReport`, `DailyClose` | 6 poti (`cash-register`, `end-of-day`, `z-report`, `shifts`) | 3 poti | shift totals (cashSales/cardSales/totalSales/cashDifference); Z totals — R110 kanon: vsi Z-pisi skozi EN upsert pod `pg_advisory_xact_lock(hashtext('z-report:<loc>:<date>'))` + CAS `{ status: { not: 'finalized' } }`; Z-poročilo = EDINI vir finančne resnice (§18); DailyClose = snapshot pariteta | 4 |
| `stocktake` Inventura (razširitev) | `Stocktake`, `StocktakeItem` | 3 poti (`inventory`) | 1 pot | expectedQuantity/countedQuantity/varianceQuantity/varianceValue = snapshoti ZA PREGLED; avtoritativni popravek = povezana StockTransaction vrstica (schema komentar L1416–1419); double-approve = updateMany status claim guard | 2 |
| `audit-infra` Audit log (infrastruktura) (razširitev) | `AuditLog` | 1 pot (`audit-log`, `compliance`) | 3 poti | SHA-256 hash veriga (previousHash\|action\|entityType\|entityId\|userId\|details → chainHash); locationId samodejno izpeljan (R81); createAuditLog = EDINI pisalni kanon od R180 (2 direktni izjemi migrirani); retention/archive delete = audited (AUDIT_RETENTION_PURGED) | 2 |

## Dejstva po virih (vsak zapis = fail-closed preverjeno ob generaciji)

### `menu-item` — Meni item / katalog · §6 moduli: `menu`, `orders`, `kitchen`, `recipes`, `food-cost`

- **Source of truth (Prisma)**: `Menu`, `MenuItem`, `Category`
- **Writers (10)**: `src/app/api/menus/route.ts`, `src/app/api/menus/[id]/route.ts`, `src/app/api/categories/route.ts`, `src/app/api/categories/[id]/route.ts`, `src/app/api/menu-items/route.ts`, `src/app/api/menu-items/[id]/route.ts`, `src/app/api/menu-items/bulk-import/route.ts`, `src/app/api/menu-items/bulk-vat/route.ts`, `src/app/api/modifier-groups/route.ts`, `src/lib/onboarding/catalog-templates/apply-starter-catalog.ts`
- **Readers (4)**: `src/app/api/menu-items/route.ts`, `src/app/api/public/menu/route.ts`, `src/app/api/mobile/menu/route.ts`, `src/app/api/public/availability/route.ts`
- **Derived values**: Sold-out NI persistiran — branje-ob-času kanon `src/lib/availability/menu-availability.ts` (computeMenuStockMap: isAvailable flag + zaloga → sold_out/unavailable/limited/in_stock, R124); uveljavljanje ob naročilu `src/app/api/orders/_helpers/post-handler.ts` (409 + soldOutItems)
- **Audit**: — (brez namenskih AuditLog akcij)
- **Opomba**: NI AuditLog akcij za meni CRUD (izrecno zabeleženo); DELETE = soft-delete (isAvailable:false), katalog ima lastno sledljivost prek DB vrstic

### `price` — Cena · §6 moduli: `menu`, `orders`, `reports`

- **Source of truth (Prisma)**: `MenuItem`, `OrderItem`, `OrderItemModifier`
- **Writers (5)**: `src/app/api/menu-items/route.ts`, `src/app/api/menu-items/[id]/route.ts`, `src/app/api/menu-items/bulk-vat/route.ts`, `src/app/api/orders/_helpers/order-items.ts`, `src/app/api/orders/[id]/_helpers/order-mutations.ts`
- **Readers (2)**: `src/app/api/public/menu/route.ts`, `src/app/api/menu-items/route.ts`
- **Derived values**: OrderItem.price/vatRate/vatAmount/menuItemName = server-avtoritativni snapshot ob naročilu (`buildOrderItemsData` — cena iz DB MenuItem.price, FIX BUG-13; client cene NIKOLI zaupane); PriceGroup NE nosi cene (samo grupiranje); ni menu versioning modela
- **Audit**: — (brez namenskih AuditLog akcij)
- **Opomba**: sprememba MenuItem.price nima namenske audit akcije (izrecno zabeleženo kot vrzel v registru tveganj — P1 kandidat)

### `recipe` — Recept / normativ · §6 moduli: `recipes`, `food-cost`, `kitchen-prep`, `recipe-scaling`

- **Source of truth (Prisma)**: `RecipeItem`, `BatchPreparation`, `BatchPreparationLine`
- **Writers (4)**: `src/app/api/recipes/route.ts`, `src/app/api/batch-preparations/route.ts`, `src/app/api/batch-preparations/[id]/complete/route.ts`, `src/app/api/batch-preparations/_helpers/batch-preparation-mutations.ts`
- **Readers (3)**: `src/app/api/recipes/route.ts`, `src/app/api/food-cost/route.ts`, `src/app/api/inventory/menu-stock/route.ts`
- **Derived values**: food cost = Σ(rawFromUsable(quantityPerServing, yieldPercent) × costPerServing) — `src/app/api/food-cost/route.ts`; RecipeItem visi direktno na MenuItem (brez samostojnega Recipe modela); sub-recepti = BatchPreparation (outputCostPerUnit = Σinput/output)
- **Audit akcije**: `BATCHPREP_CREATE`, `BATCHPREP_COMPLETE`
- **Opomba**: recept CRUD brez audit akcij; batch preparation ima BATCHPREP_*

### `stock` — Zaloga (ledger) · §6 moduli: `inventory`, `inventory-alerts`, `reorder-center`, `waste-tracker`

- **Source of truth (Prisma)**: `InventoryItem`, `StockTransaction`, `InventoryBatch`, `StockBatchAllocation`
- **Writers (10)**: `src/app/api/inventory/_helpers/stock-mutations.ts`, `src/app/api/waste/_helpers/waste-mutations.ts`, `src/app/api/stocktakes/_helpers/stocktake-mutations.ts`, `src/app/api/batch-preparations/_helpers/batch-preparation-mutations.ts`, `src/lib/stock-deduction/deduct-recipe.ts`, `src/lib/stock-deduction/return-stock.ts`, `src/app/api/purchase-orders/[id]/_helpers.ts`, `src/app/api/inventory/reorder/_helpers/create-order.ts`, `src/app/api/inventory/transactions/route.ts`, `src/app/api/order-items/[id]/_helpers/void-stock-return.ts`
- **Readers (4)**: `src/app/api/inventory/route.ts`, `src/app/api/inventory/transactions/route.ts`, `src/app/api/inventory/menu-stock/route.ts`, `src/app/api/inventory/batches/route.ts`
- **Derived values**: InventoryBatch/StockBatchAllocation = SLEDLJIVOSTNA PROJEKCIJA (schema komentar L1272–1278): InventoryItem.quantity + StockTransaction sta EDINA source of truth; sale deduction = CAS `updateMany where quantity >= qty` (`src/lib/stock-deduction/deduct-*`); R106 kanon: vse per-item absolutne mutacije pod `pg_advisory_xact_lock(hashtext('inv-stock:<itemId>'))` — R180: ročna transakcija (transactions POST) ZADNJA migrirana pot
- **Audit akcije**: `INVENTORY_ADJUST`, `AUTO_CANCEL_INSUFFICIENT_STOCK`
- **Opomba**: večina premikov NIMA audit akcije — StockTransaction ledger vrstica JE revizijska sled (previousQty→newQty veriga)

### `waste` — Odpis / šoda · §6 moduli: `waste-tracker`, `food-cost`

- **Source of truth (Prisma)**: `WasteRecord`
- **Writers (3)**: `src/app/api/waste/route.ts`, `src/app/api/waste/_helpers/waste-mutations.ts`, `src/app/api/waste/[id]/reverse/route.ts`
- **Readers (1)**: `src/app/api/waste/route.ts`
- **Derived values**: totalCost = quantity × costPerUnit snapshot (food-cost vir); reverse = kompenzacijski 'return' ledger zapis, ledger vrstica NIKOLI izbrisana
- **Audit akcije**: `WASTE_CREATE`, `WASTE_REVERSE`

### `purchase` — Nabava / PO · §6 moduli: `reorder-center`, `suppliers`, `vendor-scorecard`

- **Source of truth (Prisma)**: `PurchaseOrder`, `PurchaseOrderItem`, `GoodsReceipt`, `GoodsReceiptItem`, `ReorderRule`
- **Writers (7)**: `src/app/api/purchase-orders/route.ts`, `src/app/api/purchase-orders/[id]/route.ts`, `src/app/api/purchase-orders/[id]/_helpers.ts`, `src/app/api/purchase-orders/[id]/receive/route.ts`, `src/app/api/purchase-orders/[id]/invoice/route.ts`, `src/app/api/reorder/draft-po/route.ts`, `src/lib/predictive-ordering/index.ts`
- **Readers (4)**: `src/app/api/purchase-orders/route.ts`, `src/app/api/purchase-orders/[id]/invoice/route.ts`, `src/app/api/reports/ap-aging/route.ts`, `src/app/api/inventory/reorder/route.ts`
- **Derived values**: PurchaseOrderItem.quantityReceived/quantityRejected kumulativi; PO.status partial/received; PO.invoiceStatus none|partial|invoiced|variance (three-way match PO↔GRN↔račun); AccountsPayable.matchStatus; pack→base konverzija per PurchaseOrderItem.packQty snapshot
- **Audit akcije**: `PURCHASE_ORDER_RECEIVED`, `SUPPLIER_INVOICE_RECORDED`

### `supplier` — Dobavitelj · §6 moduli: `suppliers`, `vendor-scorecard`

- **Source of truth (Prisma)**: `Supplier`, `SupplierItem`, `SupplierPriceHistory`
- **Writers (4)**: `src/app/api/suppliers/route.ts`, `src/app/api/suppliers/[id]/route.ts`, `src/app/api/suppliers/[id]/catalog/route.ts`, `src/app/api/inventory/price-history/route.ts`
- **Readers (3)**: `src/app/api/suppliers/route.ts`, `src/app/api/suppliers/[id]/scorecard/route.ts`, `src/app/api/inventory/price-history/route.ts`
- **Derived values**: SupplierPriceHistory (source goods_receipt | manual); NAPOVED: InventoryItem.supplier legacy free-text + SupplierItem FK = vzporedna referenca (tveganje A-risk v registru)
- **Audit akcije**: `SUPPLIER_CATALOG_UPSERT`, `SUPPLIER_CATALOG_DELETE`, `SUPPLIER_PRICE_MANUAL`

### `order` — Naročilo · §6 moduli: `orders`, `kitchen`, `tables`, `floor-plan`, `danes`

- **Source of truth (Prisma)**: `Order`, `OrderItem`, `OrderItemModifier`, `Check`
- **Writers (10)**: `src/app/api/orders/route.ts`, `src/app/api/orders/_helpers/post-handler.ts`, `src/app/api/orders/[id]/add-items/route.ts`, `src/app/api/orders/[id]/_helpers/put-handler.ts`, `src/app/api/order-items/[id]/route.ts`, `src/app/api/tables/_helpers/table-ops.ts`, `src/app/api/public/kiosk/route.ts`, `src/app/api/public/order/route.ts`, `src/app/api/public/online-order/_helpers/create-order.ts`, `src/app/api/mobile/order/route.ts`
- **Readers (4)**: `src/app/api/orders/[id]/route.ts`, `src/app/api/kitchen/route.ts`, `src/app/api/dashboard/route.ts`, `src/app/api/reports/sales/route.ts`
- **Derived values**: Order/Check totals iz OrderItem vrstic; paymentStatus/paidAt (agregat čez payments — `src/app/api/payments/_helpers/check-status.ts`); firedAt (R115); readyAt/readyById/readyByName (KDS bump, R133); inventoryDeducted claim flag (P1-19); orderNumber per-location atomarni števec (`src/lib/counters.ts`); Check = plačljiva podmnožica OrderItemov (Toast-stil dvojna hramba — tveganje A3)
- **Audit akcije**: `CREATE_ORDER`, `ADD_ITEMS_TO_ORDER`, `UPDATE_ORDER_STATUS`, `CANCEL_ORDER`, `VOID_ORDER_ITEM`, `ORDER_TABLE_TRANSFER`, `COURSE_FIRE`, `TABLE_MERGE`

### `payment` — Plačilo · §6 moduli: `cash-register`, `wallet-payment`, `gift-cards`, `loyalty`

- **Source of truth (Prisma)**: `Payment`, `Check`
- **Writers (5)**: `src/app/api/payments/route.ts`, `src/app/api/payments/_helpers/create-payment.ts`, `src/app/api/payments/[id]/route.ts`, `src/app/api/payments/[id]/refund/route.ts`, `src/app/api/qr-pay/confirm/route.ts`
- **Readers (2)**: `src/app/api/payments/route.ts`, `src/app/api/cash-register/route.ts`
- **Derived values**: Check.paymentStatus/paidAt/Order.status completed — derivacija iz agregata completanih payments; LoyaltyAccount.pointsBalance + GiftCard.balance (+ledger balanceAfter); idempotency kanon: `@@unique([locationId, idempotencyKey])` + P2002 replay = isti payment (R116)
- **Audit akcije**: `CREATE_PAYMENT`, `UPDATE_PAYMENT`, `REFUND_PAYMENT`, `QR_PAY_PAYMENT`
- **Opomba**: R180: UPDATE_PAYMENT (PUT /api/payments/[id]) in QR_PAY_PAYMENT preklopljeni iz direktenga db.auditLog.create na createAuditLog hash-chain kanon (prej 2 izjemi brez verige — tveganje A8 rešeno)

### `receipt` — Račun / fiskalizacija · §6 moduli: `furs`, `z-report`, `reports`

- **Source of truth (Prisma)**: `Receipt`
- **Writers (6)**: `src/app/api/receipts/[id]/route.ts`, `src/app/api/receipts/[id]/_helpers/post-handler.ts`, `src/app/api/furs/helpers/verify-invoice/post-verify.ts`, `src/lib/outbox/processors/furs.ts`, `src/app/api/furs/helpers/storno-invoice/storno-transaction.ts`, `src/lib/cis/receipt-submission.ts`
- **Readers (3)**: `src/app/api/receipts/[id]/route.ts`, `src/app/api/digital-receipt/route.ts`, `src/app/api/furs/e-invoice-book/route.ts`
- **Derived values**: VAT breakdown snapshot ob izdaji (`calculateVatBreakdownForReceipt`); per-location številčenje (getNextReceiptNumber); zoi/eor/fiscalVerified pisci: sync verify + batch + async outbox (outbox skipa če eor že obstaja); FURS QR iz zoi+total+taxId
- **Audit akcije**: `FURS_VERIFY_SUCCESS`, `FURS_VERIFY_FAILED`, `FURS_BATCH_VERIFY`, `FURS_STORNO`

### `customer` — Gost / zvestoba · §6 moduli: `guests`, `reservations`, `loyalty`, `waitlist`, `customer-timeline`

- **Source of truth (Prisma)**: `Guest`, `GuestVisit`, `Reservation`, `LoyaltyAccount`
- **Writers (6)**: `src/app/api/guests/route.ts`, `src/app/api/guests/[id]/route.ts`, `src/app/api/guests/[id]/visits/route.ts`, `src/lib/guest-visit-chain.ts`, `src/app/api/reservations/_helpers/create-handler.ts`, `src/app/api/loyalty/[id]/route.ts`
- **Readers (3)**: `src/app/api/guests/route.ts`, `src/app/api/reservations/route.ts`, `src/app/api/loyalty/route.ts`
- **Derived values**: pointsBalance/tier iz LoyaltyTransaction ledger + `src/lib/loyalty-tiers.ts`; GuestVisit chain = hash-veriga (analogno AuditLog); točkovne mutacije pod `updateLoyaltyAccountWithLock` lock-om
- **Audit akcije**: `CREATE_RESERVATION`, `CANCEL_RESERVATION`, `GIFT_CARD_CREATED`
- **Opomba**: loyalty točke brez namenske audit akcije — LoyaltyTransaction ledger JE sled; GuestVisit chain ima lastno hash integriteto (/api/audit/guest-visit-integrity)

### `cash-shift` — Smena / Z-poročilo / EOD (razširitev) · §6 moduli: `cash-register`, `end-of-day`, `z-report`, `shifts`

- **Source of truth (Prisma)**: `CashRegisterShift`, `ZReport`, `DailyClose`
- **Writers (6)**: `src/app/api/cash-register/route.ts`, `src/app/api/cash-register/[id]/route.ts`, `src/app/api/end-of-day/_helpers/close-shift.ts`, `src/app/api/reports/eod/_helpers/eod-close.ts`, `src/app/api/z-report/_helpers/upsert-z-report.ts`, `src/app/api/daily-close/route.ts`
- **Readers (3)**: `src/app/api/cash-register/route.ts`, `src/app/api/z-report/route.ts`, `src/app/api/reports/eod/route.ts`
- **Derived values**: shift totals (cashSales/cardSales/totalSales/cashDifference); Z totals — R110 kanon: vsi Z-pisi skozi EN upsert pod `pg_advisory_xact_lock(hashtext('z-report:<loc>:<date>'))` + CAS `{ status: { not: 'finalized' } }`; Z-poročilo = EDINI vir finančne resnice (§18); DailyClose = snapshot pariteta
- **Audit akcije**: `CLOSE_REGISTER_SHIFT`, `EOD_COMPLETED`, `DAILY_CLOSE_APPROVED`, `Z_REPORT_REOPENED`

### `stocktake` — Inventura (razširitev) · §6 moduli: `inventory`

- **Source of truth (Prisma)**: `Stocktake`, `StocktakeItem`
- **Writers (3)**: `src/app/api/stocktakes/route.ts`, `src/app/api/stocktakes/[id]/approve/route.ts`, `src/app/api/stocktakes/_helpers/stocktake-mutations.ts`
- **Readers (1)**: `src/app/api/stocktakes/route.ts`
- **Derived values**: expectedQuantity/countedQuantity/varianceQuantity/varianceValue = snapshoti ZA PREGLED; avtoritativni popravek = povezana StockTransaction vrstica (schema komentar L1416–1419); double-approve = updateMany status claim guard
- **Audit akcije**: `STOCKTAKE_CREATE`, `STOCKTAKE_APPROVE`

### `audit-infra` — Audit log (infrastruktura) (razširitev) · §6 moduli: `audit-log`, `compliance`

- **Source of truth (Prisma)**: `AuditLog`
- **Writers (1)**: `src/lib/db.ts`
- **Readers (3)**: `src/app/api/audit/route.ts`, `src/app/api/audit/verify-chain/route.ts`, `src/app/api/audit/archive/route.ts`
- **Derived values**: SHA-256 hash veriga (previousHash|action|entityType|entityId|userId|details → chainHash); locationId samodejno izpeljan (R81); createAuditLog = EDINI pisalni kanon od R180 (2 direktni izjemi migrirani); retention/archive delete = audited (AUDIT_RETENTION_PURGED)
- **Audit akcije**: `AUDIT_CHAIN_VERIFIED`, `AUDIT_RETENTION_PURGED`

## Registri arhitekturnih tveganj (A0–A9)

- **A0 LEDGER PRINCIP (deklarirano)**: StockTransaction + InventoryItem.quantity = edini vir resnice za zalogo; Batch/Allocation/Waste/Check snapshoti = projekcije. Vse per-item absolutne mutacije na skupnem ključu `inv-stock:<itemId>` (R106) — od R182 brez izjem (A2 rešen: prevzem/prodaja/vračilo na istem ključu).
- **A1 🔴→✅ REŠENO R180**: POST /api/inventory/transactions je bil zadnja nekanonizirana pot (stale read izven tx + nepogojen absolutni set + silent clamp-to-0 — INV-1/INV-2 družina). Migrirano na R106 kanon (`createManualStockTransaction`): skupni lock + tx-fresh re-read + pogojni decrement (fail-closed 400 namesto clamp-a) + FEFO batch poraba. Drift-gate pini novo stanje.
- **A2 ✅→REŠENO R182 (enoten inv-stock lock kanon)**: trije zalogovni pisalni tokovi so mutirali InventoryItem.quantity MIMO R106 ključa — PO receive je ključaval samo `hashtext(poId)`, return-stock samo `stock-return:<orderId>`, sale deduction sploh brez ključavnice (samo CAS claim + pogojni decrement). Cross-domena sočasnost (prodaja ∥ odpis, vračilo ∥ prevzem) se NI serializirala na artiklu → preplet StockTransaction revizijskih vrstic (previousQty → newQty ni bil brezvsnežna veriga) + SSI abort-noise. R182: `acquireInvStockLocks` (src/lib/stock-deduction/locks.ts — sortirano, dedup, listi grafa za entitetnima ključavnica order-write/stock-return/poId, null-safe) v VSEH treh tokovih: deduct-order (pre-pass resolucija artiklov zrcali deduct-recipe/deduct-direct resolucijo, ključavnice po CAS claimu, pred mutacijami), return-stock (snapshot pot + legacy pot) in PO receive (po poId ključavnici, pred item zanko); stock-mutations re-export = enoten vir ključa. Brez izolacijskih sprememb — pisalna izključitev = advisory lock; pogojni updateMany (gte) ostane obrambna globina (Serializable na vroči prodajni poti bi DODAL P2034 retry-noise — nasprotno cilju A2). Drift-gate: tests/unit/security/r182-stock-lock-canon.test.ts (13 testov: runtime red claim→locks→mutacije, izgubljen claim = no-op, helper enota sort/dedup/null, fs-pini + negativni pini divergenc).
- **A3 ✅→REŠENO R181 (CK-5)** Order totals vs Check totals — dvojna hramba po zasnovi (Toast-stil checks = plačljive podmnožice), reizračun iz istih OrderItem vrstic. NEKOČ ŠIBKA TOČKA: `recalculateAffectedChecks` je deloval read-modify-write na golem clientu BREZ tx/ključavnice (vzorec, ki ga je R109 popravil na void poti). CK-5 kanon: create + link + recalc (preimenovan v `recalculateAffectedChecksInTx`) VSE v enem $transaction(Serializable) pod advisory locks v fiksnem vrstnem redu (`order-write:`+orderId → sorted raw checkId, enaka ključa kot R109/R108 in plačilne poti) + tx-fresh re-read naročila/artiklov + tx-fresh guard proti plačanim čekom + CAS updateMany (paymentStatus not paid). Drift-gate: tests/unit/security/r181-checks-post-kanon.test.ts (14 testov, vključno z negativnimi pini starega db-client vzorca).
- **A4 ✅ Cena** — legitimni snapshot, NI drugega neodvisno mutabilnega vira: MenuItem.price edini mutable; OrderItem.price server-computed enkrat ob naročilu; client cene nikoli zaupane; PriceGroup ne nosi cene.
- **A5 ✅ Sold-out** — deriviran, NI persistiran: read-time kanon (`menu-availability.ts`) + uveljavljanje ob naročilu (R124 409); `MenuItem.isAvailable` = ročni 86-flag z enim pisalcem.
- **A6 🟡 Trojni pisec smene/Z** — 3 rute zaprejo smeno (cash-register/[id], end-of-day, reports/eod), vse CAS `updateMany {status:'open'}` + vse Z-pise skozi EN R110 upsert z ključavnico. Urejena multiplikativnost — sprejemljivo, občutljivo na drift.
- **A7 🟡 Derivacija plačilnega statusa podvojena**: kanon v `check-status.ts`, ampak qr-pay/kiosk/refund re-implementirajo dele tranzicij inline; refund direktno prevrača loyalty/giftcard balance (z ledger vrsticami ob strani). Drift tveganje, ne korupcija.
- **A8 🔴→✅ REŠENO R180**: 2 direktni `db.auditLog.create` brez hash verige (payments/[id] UPDATE_PAYMENT, qr-pay/confirm QR_PAY_PAYMENT) → migrirano na `createAuditLog` kanon (SHA-256 veriga). Drift-gate pini odsotnost direktenga pisanja v teh dveh datotekah.
- **A9 ✅ AuditLog sam** — enoten helper s hash verigo; direktne izjeme = A8 (rešeno R180); retention/anonymization delete = namenski + audited.

## Legenda / Anti-overclaim

- Ta dokument = **strukturna verifikacija kode** (fail-closed sidra na realne datoteke, modele, §6 module in audit akcije) — **NE produkcijska validacija**. Kritično pravilo epika #144 §8 velja tudi tu: zelen CI NI isto kot produkcijska validacija (dokazni kanali = VALIDATION-MATRIX §8).
- **Ledger princip**: kjer opomba pravi "ledger JE sled" (StockTransaction / LoyaltyTransaction / GiftCardTransaction / GuestVisit chain), je revizijska sled DB vrstica s prej/potem ali hash-verigo — namenski AuditLog akciji ni treba obstajati, ampak mora biti to IZRECNO zabeleženo (nikoli tiho).
- **Audit brez akcij = izrecno zabeleženo**: vsaka vrzel ima `Opomba` v anchor sekciji; noben `—` v stolpcu Audit ni implicitna trditev pokritosti.
- Vsak ✓/sidro zahteva NOV dokaz (realna datoteka / akcija v src scanu); brisanje ali preimenovanje sidra = fail-closed napaka ob generaciji + rdeč drift-gate.
