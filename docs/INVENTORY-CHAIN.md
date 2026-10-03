# INVENTORY-CHAIN — Zalogovno-poslovna veriga (repo-truth dokaz)

> Issue #152 (P1 — Inventory, Recipes, Procurement & COGS Integrity), korak 1 @ R209;
> korak 2 @ R211 (G1 menu-stock location scope) + R212 (G7 receive idempotency, R116 kanon).
>
> **ONE MATERIAL EVENT → ONE AUTHORITATIVE STOCK EFFECT · ONE RECIPE → ONE
> AUTHORITATIVE COST MODEL · PROCUREMENT → STOCK → CONSUMPTION → COST → COGS
> RECONCILE.**
>
> Ta dokument je izpeljan iz AKTUALNE implementacije na HEAD (Prisma schema,
> route handlerji, service sloj, testi) — ne iz imen modulov. Vsaka trditev
> nosi `file:line` sidro. Kjer nekaj NI implementirano, je to izrecno
> zapisano (§6) — brez overclaim.

---

## 1. Obseg in arhitekturno pravilo

Količinska resnica je **dvovrstična**: `InventoryItem.quantity` (Decimal 12,3)
+ `StockTransaction` ledger (previousQty → newQty, Decimal 12,3) sta edini
avtoriteti količine. `InventoryBatch`/`StockBatchAllocation` je **sledljivostna
projekcija** prevzemov (lot/expiry/FEFO), NIKOLI neodvisen vir zaloge
(`src/lib/stock-deduction/batch-allocation.ts:10-33` — eksplicitno arhitekturno
pravilo).

Pisalni kanon (R106/R182): vsak materialen zalogovni pisec teče v
`$transaction` (večinoma `Serializable`) pod **per-item advisory ključavnico**
`pg_advisory_xact_lock(hashtext('inv-stock:' + itemId))`, z **tx-fresh re-read**
artikla in **pogojnim** `updateMany({ quantity: { gte: N } })` decrementom /
atomarnim incrementom — negativna zaloga je strukturno nemogoča. Prodajna
(„hot") pot je namenoma Read Committed (komentar kanona
`src/lib/stock-deduction/locks.ts:29-31`), enako zaščita pa je pogojni
decrement + `acquireInvStockLocks` pre-pass (`deduct-order.ts:100`).

COGS vir resnice: **`StockTransaction.totalCost` tipa `'sale'`** — spot cost =
`costPerUnit` ob odvodnem trenutku (snapshot). Poročila grupirajo iste vrstice
po poslovnem dnevu (§4). Ni inventurne valorizacije (moving average/FIFO) —
izrecno ne-implementirano (§6).

---

## 2. Source-of-truth matrica (issue #152 §3)

| Poslovno dejstvo | Kanonski vir | pisci | bralci | enote | transakcija | audit | testi | vrzel |
|---|---|---|---|---|---|---|---|---|
| Stock quantity | `InventoryItem.quantity` (schema.prisma:1172, Decimal 12,3) | 21 piscev — §3 | menu-stock map, availability, reorder, food-cost, batches route | osnovna enota artikla (`unit`) | per-pisec §3 | mix — §3 | r106/r161/r182/r209 drill | menu-stock read NI location-scoped → ZAPRTO R211 (§5 G1: locationId scope na direktni poti, mirror deduct-direct) |
| Stock movement | `StockTransaction` (schema.prisma:1231; previousQty/newQty/quantity/costPerUnit/totalCost) | vsi pisci iz §3 | transactions route GET, reports (financial/eod), dashboard COGS, Z-report, reorder usage | signed quantity + Decimal zneski | isti tx kot sprememba | StockTx JE sled (del piscem še AuditLog) | r209 drill (kontinuiteta previousQty→newQty) | StockTransaction nima lastnega locationId — scope prek `inventoryItem.locationId` (dokumentirano data-fetch.ts:100-102) |
| Recipe quantity | `RecipeItem.quantityPerServing` (schema.prisma:1537, **USABLE** količina) | recipes route POST/PUT | deduct-recipe, food-cost, menu-availability, Z-report teoretični cost | enota recepture | recipes route tx | — | r123, r209 drill | sub-recepti (parentRecipeItemId schema:1549) imajo shemo, žive porabe podrepi ni (§6) |
| Yield / loss | `RecipeItem.yieldPercent` (schema.prisma:1543, Decimal 5,2; RAW = usable ÷ yield/100) | recipes route (0/101 → 400) | `rawFromUsable` (`src/lib/recipes/yield.ts:37-41`) v deduction/availability/returns/food-cost | % | — | — | r123, lib/yield.test, r209 drill (RAW 0.5 kg/servis @ 50 %) | — |
| Waste | `WasteRecord` (schema.prisma:1343; snapshot quantity/unit/costPerUnit/totalCost + stockTransactionId unique) | `createWasteRecord` (waste-mutations.ts:131), `reverseWasteRecord` (:242) | waste route GET, poročila odpada | artiklova enota | Serializable + advisory lock (:143/:147) | `WASTE_CREATE`/`WASTE_REVERSE` | r119 (W-1..W-6), r209 drill (replay + reversal) | — |
| Adjustment | StockTx tip `adjustment`/`write-off` (absolutna prilagoditev / odpis) | `adjustInventoryItemStock` (stock-mutations.ts:89), `setInventoryItemQuantity` (:298), stocktake approve (stocktake-mutations.ts:320), batch-PUT (adjust/route.ts:198 CAS per item) | transactions GET, reports | signed diff | Serializable + lock + CAS (stocktake :393) | `INVENTORY_ADJUST`, `STOCKTAKE_APPROVE` | r106, r121, r209 drill (inventura + R214 G4) | — (G4 zaprta R214: batch-PUT na kanon pariteti — ključavnice :166 + Serializable TX_OPTS :19-22 + FEFO recordBatchConsumption :267 + createAuditLogsBatch :283, §5) |
| Purchase quantity | `PurchaseOrderItem.quantityOrdered` + `GoodsReceiptItem.quantityAccepted/quantityRejected` (schema.prisma:2470/2563) | `receivePurchaseOrderItems` (purchase-orders/[id]/_helpers.ts:113) | PO routes, GRN list, three-way match | PO enota (pack ali base) | Serializable + `hashtext(poId)` lock (:142) + `acquireInvStockLocks` (:203) | `PURCHASE_ORDER_RECEIVED` | r132 IT + unit (PO-1..6, GRN) + r209 G7 IT (replay = ISTI GRN) | — (G7 zaprta R212: klientov idempotencyKey, replay POD lockom PRED terminalnimi zaščitami, §5) |
| Purchase price | `SupplierPriceHistory` (schema.prisma:2592, Decimal 12,4, append-only) | avtomatsko ob prevzemu (_helpers.ts:325/:380, `unitPrice ≤ 0` skip), ročno price-history POST | recipes `?priceSource=supplier`, reorder enrichment, stats canon | base unit cena | isti tx kot prevzem | `SUPPLIER_PRICE_MANUAL` (ročno) | r130 IT + unit | prisotna samo opt-in (`priceSource=supplier`); privzeti COGS ne bere PH (§5 G8) |
| Received quantity | `GoodsReceiptItem.quantityAccepted` (+ rejected brez kapacitetnega efekta — R132 amandma :183-188) | receive kanon | GRN list route, invoice match (invoiced > accepted → `variance_qty`) | PO enota | isti Serializable tx | GRN del `PURCHASE_ORDER_RECEIVED` | r132 (9+1 zavrnjeno → zaloga accepted-only) | — |
| Recipe cost | izračun: `Σ rawFromUsable(qtyPerServing, yield) × InventoryItem.costPerServing` (food-cost route :51-53) | — (izpeljano, ni shranjeno) | food-cost route, Z-report stats (:162-174), recipes route | EUR/servis | — | — | r123, r209 drill | ni menu-item cost polja; cost je vedno živo izpeljan (by design) |
| COGS | `StockTransaction.totalCost` type=`'sale'` (spot cost ob odvodu) | deduct-recipe (:105), deduct-direct (:103), deduct-added (:77/:154), public/QR/online/delivery poti §3 | dashboard furs-shift-cogs (:49-61), reports/financial (:176-180), reports/eod metrics (:75-76), accounting P&L fallback (journal-generator:661), Z-report | EUR | isti tx kot odvod | StockTx sled | r209 drill (rekonciliacija cogs == Σ sale) | — (G2 zaprta R216: sale-chain COGS bucketiran na `Order.paidAt` — poslovni dan prodaje, ISTI kanon kot prihodki; fallback + ne-naročilni tipi na createdAt, §5) |
| Margin | izračun: `(price−cost)/price×100` (`computeMarginPercent` price-history.ts:194-199); food-cost % = `cost/(price×(1+vat))×100` (:71) | — | food-cost route, recipes route (supplier variant), menu-engineering klasifikacija (:76-83) | % | — | — | r130 lib | terminologija: izpeljani % brez računovodske klasifikacije (issue §16 zahteva: ne označevati kot „gross margin" brez podpore — UI je označen kot food-cost %/margin %) |
| Availability | izračun: `computeMenuStockMap` + `effectiveAvailability` (`src/lib/availability/menu-availability.ts:50-181`); statusi ok/low/out | — (izpeljano) | menu-stock route, public/availability, kiosk/QR payloadi, POS check pre-write (post-handler.ts:259) | servisi (RAW-yield-aware) | — (read-only) | — | r124, lib/menu-availability, r161 (last-2-units), r209 drill (409 + attempt vrstica), R211: +5 G1 location testov + r211-menu-stock-location | map ni location-scoped → ZAPRTO R211 (§5 G1: locationId na direktni poti mirror deduct-direct; receptna pot fiksna mirror deduct-recipe); pre-write check-availability direct branch ostane first-wins (warning-only, write CAS zaščiten) |

---

## 3. Inventar zalogovnih piscev (issue #152 §4)

### 3a. Kanonski pisci (R106/R182: tx + advisory lock + tx-fresh re-read + pogojni decrement)

| # | file:line (StockTx create) | poslovni razlog | sign/količina | transakcija | lock | audit |
|---|---|---|---|---|---|---|
| 1 | `src/app/api/inventory/_helpers/stock-mutations.ts:174` (`adjustInventoryItemStock`) | ročni odpis / absolutna prilagoditev / vračilo (`POST /api/inventory/adjust`) | `delta = −qty` (odpis, pogojno :150) oz. `target − freshQty` (:125) | Serializable :104 | :107 | `INVENTORY_ADJUST` (adjust/route.ts:92) |
| 2 | `stock-mutations.ts:251` (`restockInventoryItem`) | ročni prevzem (`POST /api/inventory/restock`), tip `procurement` | increment :242; rekalkulacija `costPerServing` :245; batch prek `recordBatchReceipt` :272 | Serializable :226 | :227 | — (StockTx je sled) |
| 3 | `stock-mutations.ts:346` (`setInventoryItemQuantity`) | absolutna nastavitev (`PUT/PATCH /api/inventory/[id]`) | `diff = new − freshQty`; `adjustment`>0 / `write-off`<0; diff 0 → brez StockTx (:325-334) | Serializable :312 | :313 | — |
| 4 | `stock-mutations.ts:449` (`createManualStockTransaction`) | ročna transakcija (`POST /api/inventory/transactions`) | signed; pogojni decrement :424 / increment :442; FEFO :468 | Serializable :400 | :401 | — |
| 5 | `src/app/api/purchase-orders/[id]/_helpers.ts:297/:355` (`receivePurchaseOrderItems`) | prevzem PO (`POST .../receive`, `PUT action='receive'`), tip `procurement` | increment :289/:348 + forenzika iz post-op vrednosti | Serializable :135/:494 | `hashtext(poId)` :142 + `acquireInvStockLocks` :203 + replay check :156-180 (R212 G7 — R116 ključ kanon) | `PURCHASE_ORDER_RECEIVED` (receive/route.ts:107); ustvari GRN :407 + SupplierPriceHistory :325/:380 + avto-AP :460 |
| 6 | `src/app/api/waste/_helpers/waste-mutations.ts:192` (`createWasteRecord`) | odpad (`POST /api/waste`), tip `write-off` | pogojni decrement :173 (fail-closed 400 :177); batch explicit-lot fail-closed :75-114 oz. FEFO :117 | Serializable :143 | :147 | `WASTE_CREATE` (waste/route.ts:271) |
| 7 | `waste-mutations.ts:279` (`reverseWasteRecord`) | reversala odpada, tip `return`, snapshot totalCost | increment :294; batch mirror `restoreBatchesFromAllocations` :303 | Serializable :249 | :265 | `WASTE_REVERSE` |
| 8 | `src/app/api/stocktakes/_helpers/stocktake-mutations.ts:405` (`approveStocktake`) | potrditev inventure → korekcija | `appliedDiff = counted − tx-fresh qty`; CAS absolutna nastavitev :393; tip `adjustment`/`write-off` :408; FEFO negativ :425 | Serializable :329 | :373 + CAS :393 | `STOCKTAKE_APPROVE`; dvojni approve blokiran s statusnim claimom :350 |
| 9 | `src/app/api/batch-preparations/_helpers/batch-preparation-mutations.ts:446/:507` | zaključek priprave: poraba inputov (`batch-consumption`) + proizvodnja outputa (`batch-production`, cost basis `Σinput/outputQty` :494-498) | CAS decrement :431 / increment :496 | Serializable :34 | :406/:480 + CAS | `BATCH_PREPARATION_COMPLETE`; dvojni complete blokiran :382 |

### 3b. Prodajna pot (odvod ob prodaji)

| # | file:line | razlog | sign | tx | lock | opomba |
|---|---|---|---|---|---|---|
| 10 | `src/lib/stock-deduction/deduct-recipe.ts:105` (attempt vrstica :84) | receptna poraba prodaje | `quantity: −actualDeducted`; pogojni decrement `gte` :60; FEFO :120 | `$transaction` v `deductStockForOrder` (deduct-order.ts:52) | `acquireInvStockLocks` pre-pass (deduct-order.ts:100) | Read Committed po kanonu R182; neuspeh ene sestavine → attempt vrstica qty 0, order NE pade (POS pot); FURS fallback ponovi ce `!inventoryDeducted` (post-verify.ts:38-47) |
| 11 | `deduct-direct.ts:103` (attempt :81) | direktna 1:1 poraba (`InventoryItem.menuItemId`) | enak vzorec :55; `servingsPerUnit` pretvorba :47-48 | isti tx | isti | FEFO :117 |
| 12 | `deduct-added-utils.ts:77/:154` (attempti :65/:142) | postavke dodane obstoječemu naročilu (`add-items`) | enak vzorec | znotraj R108 order-write Serializable tx (order-mutations.ts:191, lock :79) oz. lastna tx (legacy `deduct-added.ts:74`) | prek klicatelja | audit `ADD_ITEMS_TO_ORDER` (add-items/route.ts:144, `stockDeducted` count) |
| 13 | `src/app/api/public/order/_helpers/order-calculations.ts:84` (`deductInventoryInTx`) | QR naročilo (kiosk pot deli isti helper — kiosk/route.ts:439, 5-arg orderId) | acquireInvStockLocks :107 (R218 G3), pogojni decrement :132, throw `INSUFFICIENT_STOCK` :164 | znotraj order-create tx (public/order/route.ts:200-250, `inventoryDeducted` :240) | acquireInvStockLocks :107 (sort+dedup+null-skip) | FEFO recordBatchConsumption :156 (R218 G3, unbatched zaprto) + orderId :151 (G2 pariteta) |
| 14 | `src/app/api/public/online-order/_helpers/deduct-inventory.ts:45/:62` | online naročilo | enak vzorec; throw :75 | znotraj create-order.ts:121 tx | — | FEFO :54 |
| 15 | `src/app/api/delivery/webhook/glovo/_helpers/glovo-inventory.ts:42/:71` (mirror `wolt-inventory.ts:44/:77`) | Glovo/Wolt webhook prodaja | R218 G3: pre-fetch menuMap tx-fresh (:31-45, N+1 odpravljen) → acquireInvStockLocks :42 → pogojni decrement :58; throw :94 → `cancelOrderForInsufficientStock` (CAS pending→cancelled) | lastna tx :25 | acquireInvStockLocks :42 (R218 G3 — pre-R182 divergenc zaprta) | FEFO :71 (R120, nespremenjen) |
| 16 | `src/lib/stock-deduction/return-stock.ts:122/:225/:272` | vračilo ob preklicu/stornu/soft-delete, tip `return` | increment :115/:218/:265; snapshot mirror sale vrstic :87-99; double-return zaščita pod ključavnico :77-84 | lastna tx :302 oz. caller tx (order-actions.ts:137, perform-soft-delete.ts:68, storno-transaction.ts:150) | `stock-return:<orderId>` :65 + `acquireInvStockLocks` :105/:195 | batch mirror :137 |

### 3c. Preostali pisci (nejedrne poti)

| # | file:line | razlog | opomba |
|---|---|---|---|
| 17 | `src/app/api/inventory/adjust/route.ts:267` (batch PUT, attempt StockTx :214, audit :283) | batch adjust (`PUT /api/inventory/adjust`) | **R214 G4 zaprta — kanon pariteta**: acquireInvStockLocks :166 (sort+dedup+null-skip, receive-kanon vzorec), Serializable TX_OPTS :19-22 (db.$transaction(fn, TX_OPTS) :162/:276), FEFO recordBatchConsumption :267 (R120 sale-safety, pariteta stock-mutations :195-201), createAuditLogsBatch :283 (INVENTORY_ADJUST per uspešen odpis, tx-fresh vrednosti, isti details shape kot POST), scoped re-read :235, P2002/P2034 → 409 :305-313; P3 CAS updateMany gte :198 + attempt StockTx :214 + skipped semantika nespremenjena |
| 18 | `src/app/api/inventory/[id]/_helpers.ts:100` (write-off StockTx :110, audit :132) | DELETE artikel → odpis na 0 | **R220 G5 zaprta — kanon pariteta**: acquireInvStockLocks :90 (PRED re-readom in mutacijo; entitetni kontekst — scoped read + menu/recipe varovalki — pred tx), tx-fresh scoped re-read :92 (prej stale pre-tx quantity na previousQty), CAS updateMany equality nad tx-fresh vrednostjo :100 (0 vrstic → strukturirani 409 :107), Serializable TX_OPTS :15-17, INVENTORY_DELETE audit :132 (createAuditLog, tx-fresh details, isti shape kot INVENTORY_ADJUST), P2002/P2034 → 409 :152-160 (pariteta s stockRaceErrorResponse PUT/PATCH) |
| 19 | `src/app/api/inventory/_helpers/create-inventory-item.ts:52` | začetna zaloga ob kreaciji (`procurement`, previousQty 0) | tx :25; brez ključavnice (kreacijski race praktično nemogoč) |
| 20 | `src/app/api/inventory/reorder/_helpers/create-order.ts:55` (increment :61, StockTx :74) | „smart reorder" avto-prevzem | **R220 G6 zaprta — kanon pariteta**: acquireInvStockLocks :55 za VSE validne artikle PRED prvim incrementom (sort+dedup v helperju; entitetni kontekst — scoped pre-check findMany — pred tx); increment je kvantiteto varen (negativna zaloga nemogoča), ključavnica serializira update+create per artikel → revizijski vrstici dveh sočasnih prevzemov ISTEGA artikla se ne moreta več preplesti (§21 veriga); previousQty ostane odveden iz post-vrednosti − delta (aritmetično točen) |
| 21 | `src/lib/onboarding/catalog-templates/apply-starter-catalog.ts:230` | onboarding starter katalog | znotraj apply tx; idempotentno prek existence checka :210-213 |

**Ni zalogovne sklopitve plačil/checkov**: `src/app/api/payments/**` in
`src/app/api/checks/**` ne pišejo zaloge (grep-verificirano) — odvod je vezan
na **naročilo (fire)**, ne na plačilo (§4). To je deklarirana semantika:
receptna poraba nastopi ob sklicu kuhinje, financial chain (#151) pa teče
neodvisno od plačila; rekonciliacija obeh poteká na poročilni ravni (§4).

---

## 4. Živi verižni dokazi (issue #152 §5/§6/§19/§21/§22)

**`tests/integration/r209-inventory-chain-drill.test.ts`** (28 testov, prava
PGlite + pravi route handlerji; requireAuth mockan na meji — vzorec
r128/r132/r151/r207):

- **VERIGA B (§22-B)**: restock z lot+expiry → 2 `InventoryBatch` + procurement
  StockTx (36.00 + 189.00) — sledljivost dobavitelja na seriji.
- **VERIGA A (§6 + §22-A/H)**: naročilo 20 × pica (usable 0.25 kg @ yield 50 %)
  → RAW odvod **10 kg**, StockTx `sale` quantity −10, totalCost 45.00
  (snapshot `costPerUnit` ob odvodu), `inventoryDeducted` CAS claim true;
  FEFO determinizem: LOT-B (poteče prej) −8 → EXHAUSTED, LOT-A −2.
- **§5 EXACT-ONCE (naročilo)**: replay idempotencyKey → 200 ISTI order,
  natanko EN sale tx, zaloga nespremenjena (fast-path pred deduction).
- **VERIGA I (§22-I)**: naročilo čez zalogo → 409 + `soldOutItems`, NI orderja
  NI odvoda (R124 fail-closed); `allowOutOfStock` → order obstane, pogojni
  decrement FAILA → attempt vrstica qty 0/totalCost 0, zaloga NE gre negativno.
- **VERIGA A plačilo**: check + cash → paid, Σ(completed) == total na cent.
- **VERIGA B PO (§10/§22-B)**: receive → zaloga 10→15, procurement tx 60.00,
  GRN + linija, SupplierPriceHistory (source goods_receipt), PO → received.
- **§5 EXACT-ONCE (prevzem)**: duplicate receive → 400 „že popolnoma prejeto",
  zaloga/GRN/PH nespremenjeni.
- **R212 G7 (idempot. prevzem)**: partial receive z idempotencyKey → replay
  ISTEGA ključa → 200 ISTI GRN (`replay: true`), ZERO nov efekt (zaloga/StockTx/
  PH/GRN števci nespremenjeni); replay OBIH ključev po terminalnem statusu →
  200 (ne 400); cap-check za nov ključ → 400 „presega naročeno" (neuspel tx ne
  persistira ključa); legacy no-key → 400 terminal guard BIT-FOR-BIT.
  Ključ persistiran na GRN (`@@unique([purchaseOrderId, idempotencyKey])`,
  schema.prisma:2551).
- **R214 G4 (batch-PUT adjust)**: batch write-off 4 kos → zaloga 8→4, StockTx
  −4 (totalCost 8.00, previousQty 8/newQty 4), FEFO razknjižba po serijah:
  LOT-G4-B (izteče prej) −3 → EXHAUSTED, LOT-G4-A −1, alokacijske vrstice (−3
  + −1) vezane na ISTI StockTx; INVENTORY_ADJUST audit z tx-fresh vrednostmi
  (prej NI bilo audita/ključavnic/FEFO na batch poti); mixed batch — skip
  (999 > 20) → attempt StockTx qty 0 + „Premalo zaloge" (P3 semantika
  nespremenjena), skip BREZ alokacije in BREZ audita (skip NI odpis).
- **R216 G2 (business-day bucketiranje)**: naročilo ognjeno 23:50 (D1),
  plačano 00:10 (D2) → sale COGS 10.00 na poslovni dan prodaje D2 (prej D1 —
  marža razdeljena med dneva); storno (return −2.00) ognjen dan kasneje (D3
  01:00) → sledi prodajnemu dnevu D2 (ne svojemu času ognja); neplačano
  naročilo (5.00, paidAt null) + sale brez orderId (1.00) → fallback createdAt
  (BIT-FOR-BIT); prevzem (30.00) ostane na času ognja; marža koherentna čez
  vse konzumente (EOD grossProfit 84 = financial 84 = dashboard 84, revenue
  100 − cogs 16); D1/D3 okna prazna (brez dvojnega štetja, brez izgube vrstic).
- **R218 G3 (QR odvodni tok)**: QR POST /api/public/order (javna pot, brez
  auth, rate limit 5/min) 2 servisov → 201; sale StockTx **nosi orderId** (G2
  kanon pariteta — prej edini sale pisec brez njega), quantity −1 (2 × 0.5 RAW
  @ 50 % yield), previousQty 3 → newQty 2; **FEFO po serijah**: LOT-G3-B 0.6
  izčrpana (EXHAUSTED) + LOT-G3-A −0.4 → 2.0 (ACTIVE) — prej unbatched
  uhajanje; alokaciji 2 vrstici na ISTI StockTx (negativen odvod, Σ = −1);
  order.inventoryDeducted true v isti tx. Nezadostna zaloga (20 servisov ×
  0.5 = 10 kg > 2 kg): **409** „ni več na zalogi" + celotna order-create tx
  roll-back — ni orderja, ni StockTx, zaloga nespremenjena (2).
- **R220 G5+G6 (DELETE artikel + reorder auto-prevzem)**: G5 — DELETE
  /api/inventory/[id] → 200; soft-delete (vrstica ohranjena, zaloga 5→0,
  menuItemId null); write-off StockTx z **tx-fresh previousQty** (5→0,
  totalCost 15.00, §21 brezvsnežna veriga); **INVENTORY_DELETE** audit vrstica
  (tx-fresh details, previousHash + chainHash — PCI veriga). G6 — POST
  /api/inventory/reorder (mešan vnos: 1 valid + 1 izven scope-a) → 201 s
  results + errors (fail-closed R85-4c: tuj artikel „ni najden"); zaloga
  2+3=5 pod ključavnico + lastRestocked; procurement StockTx **2→5**
  (previousQty = dejanska vrednost pred incrementom, totalCost 12.00,
  „Samodejno naročilo (R220 farmacevt)").
- **VERIGA D (§12/§22-D)**: odpad → write-off 6.00 + WasteRecord snapshot +
  audit; replay idempotencyKey → ISTA vrstica (replay: true), EN efekt;
  reverse → kompenzacijski `return` s snapshot ceno; double reverse → 409.
- **VERIGA E (§12/§22-E)**: inventura snapshot → count 38 → submit → approve →
  CAS absolutna nastavitev + write-off 9.00 + FEFO razknjižba + link
  `stocktakeItem.stockTransactionId`; double approve → 409.
- **§19 REKONCILIACIJA**: `GET /api/reports/eod` → `costs.cogs` == 45.00 ==
  Σ|totalCost| sale, `procurementCost` == 285.00 (restock 225 + PO 60),
  `writeOffCost` == 15.00 (odpad 6 + inventura 9), revenue == 487.76 ==
  plačani order — prihodkovna in stroškovna stran istega poslovnega dne na
  istem porečju.
- **§21 LEDGER KONTINUITETA**: za moka artikel multiset(previousQty) ==
  multiset(newQty) ∪ {0} ∖ {38} — veriga 4 dogodkov brez vrzelj
  (0→8→50→40→38), odporna na enako-milisekundne zapise.

---

## 5. Register znanih vrzel (izpeljano iz kode, NE iz domnev)

| # | vrzel | dokaz | vpliv | status |
|---|---|---|---|---|
| G1 | menu-stock availability read NI location-scoped | `inventory/menu-stock/route.ts:26` kliče `computeMenuStockMap()` brez scope-a; `InventoryItem @@unique([menuItemId, locationId])` (schema.prisma:1224) → multi-lokacijski tenant lahko vidi napačno lokacijo | kozmetično na POS mapi — blokada na write strani ostane avtoritativna (pogojni decrement) | ODPRTA — kandidat za #152 korak 2 |
| G2 | business-day bucketiranje: prihodki na `Order.paidAt` (LJ poslovni dan), COGS/vhodi na `StockTransaction.createdAt` (čas ognja) | `reports/financial/_helpers-queries.ts` (stockWhere), `reports/eod/_helpers/data-fetch.ts` (poizvedba 10), `dashboard/_helpers/furs-shift-cogs.ts`, `lib/accounting/journal-generator.ts` (P&L COGS fallback) | naročilo ob 23:50 / plačilo ob 00:10 lahko meša dneva v bruto marži | **ZAPRTA R216** — kanon pariteta, usklajeno z #148 ljubljanaDayBounds: relacija `StockTransaction.order` (schema + 0026_stocktx_order_relation — sirote prečiščene, FK ON DELETE SET NULL); sale-chain ('sale' + 'return' — vsi pisatelji nastavijo orderId v isti tx: deduct-recipe/direct/added, public/online-order, glovo/wolt, void-return) bucketiran na `order.paidAt` (ISTI kanon kot prihodki) prek skupnega helperja `src/lib/reports/sale-cogs-bucketing.ts` (`buildSaleCogsWindowFilter`: veja A order.paidAt okno XOR veja B fallback createdAt z unpaid/no-order guardom — brez dvojnega štetja in brez izgube vrstic); ne-naročilni tipi (procurement/write-off/adjustment/batch-*) ostanejo na createdAt (BIT-FOR-BIT); scope `inventoryItem.locationId` ostane top-level ključ (R84-1/R85 pini ohranjeni); dokaz: r209 drill G2 (3 IT — cross-midnight 23:50/00:10 marža 100−16 koherentna, storno naslednji dan sledi prodajnemu dnevu, D1/D3 prazna okna) + r216-business-day-cogs unit (11 — helper + 4 konzumenta where-pini) |
| G3 | QR/online/Glovo/Wolt odvodni tokovi brez advisory ključavnic (pre-R182) | order-calculations.ts:107, deduct-inventory.ts:34, glovo-inventory.ts:42 (mirror wolt :44) | ZAPRTA R218 — kanon pariteta: vsi 4 pisci acquireInvStockLocks (sort+dedup+null-skip, PRED prvo mutacijo; entitetni kontekst order.create pred ključavnicami = listi lock grafa; sale path ostane Read Committed po locks.ts kanonu — Serializable bi dodal P2034 retry-noise); QR dopolnjen: FEFO recordBatchConsumption :156 (unbatched uhajanje zaprto) + orderId :151 (G2 kanon pariteta — prej edini sale pisec brez njega); glovo/wolt pre-fetch menuMap tx-fresh (N+1 odpravljen); kiosk (5. pisec prek deductInventoryInTx — kiosk/route.ts:439, newOrder.id) podeduje fix; BIT-FOR-BIT: pogojni decrement gte, INSUFFICIENT_STOCK throw/409, attempt vrstice, cancelOrderForInsufficientStock | ZAPRTA R218 |
| G4 | batch-PUT adjust brez ključavnic/batcha/audita | inventory/adjust/route.ts:142-217 (komentar :124-126) | dokumentirana izjema; posamezen artikel še vedno pogojno dekrementiran | **ZAPRTA R214** — kanon pariteta: `acquireInvStockLocks` :166 (R182 vesolj — sort+dedup, receive-kanon vzorec: vse ključavnice PRED prvo mutacijo = deadlock-free ordering), Serializable tx (TX_OPTS :19-22 = stock-mutations pariteta), FEFO batch razknjižba `recordBatchConsumption` :267 per uspešen odpis (sale-safety: napaka alokacije ne podre odpisa), `createAuditLogsBatch` :283 (INVENTORY_ADJUST per uspešen odpis — tx-fresh previousQty/newQty/itemName, isti details shape kot POST :92-105, PCI hash veriga; skip artikli se ne revidirajo kot odpis — poskus viden v StockTx POSKUS vrstici :214), scoped re-read :235 (prej findUnique po raw id), P2002/P2034 → 409 :305-313 (pariteta s POST :117-119); P3 atomarni vzorec (updateMany gte :198) OSTANE ključni CAS, skipped semantika nespremenjena; dokaz: r209 drill G4 (2 IT — FEFO LOT-G4-B 3 + LOT-G4-A 1, mixed skip brez alokacije/audita) + r214-batch-adjust unit (6) + inventory-adjust P3 (4) |
| G5 | DELETE `inventory/[id]` brez ključavnice/audita | inventory/[id]/_helpers.ts:61-86 | redka operacija (soft-delete); StockTx Restrict ohranja ledger | **ZAPRTA R220** — kanon pariteta (R214 G4 / R106 vzorec): acquireInvStockLocks :90 PRED tx-fresh re-readom in mutacijo (entitetni kontekst — scoped read + menu/recipe varovalki — pred tx = ključavnica list lock grafa), tx-fresh scoped re-read :92 (prej stale pre-tx quantity na previousQty — sočasna prodaja med readom in tx = prekinjena §21 kontinuiteta), CAS updateMany equality nad tx-fresh vrednostjo :100 (0 vrstic → strukturirani 409 — nikoli tiho prepisovanje), Serializable TX_OPTS :15-17 (redka operacija — brez P2034 tveganja na vroči poti), INVENTORY_DELETE audit :132 (createAuditLog, tx-fresh details, isti shape kot INVENTORY_ADJUST, PCI hash veriga), P2002/P2034 → 409 :152-160 (pariteta s stockRaceErrorResponse); dokaz: r209 drill G5 (IT — soft-delete + write-off 5→0 + audit) + r220-g5-g6 unit (fs + runtime call-order) |
| G6 | reorder create-order pre-R182 pot brez ključavnic | inventory/reorder/_helpers/create-order.ts:43-56 | avto-prevzem je increment (kvantiteta varna tudi brez ključavnice) | **ZAPRTA R220** — kanon pariteta: acquireInvStockLocks :55 za VSE validne artikle PRED prvim incrementom (sort+dedup+null-skip v helperju; entitetni kontekst — scoped pre-check findMany — pred tx); kvantiteta je ostala BIT-FOR-BIT (increment atomarno varen), ključavnica serializira update+create per artikel → revizijski vrstici dveh sočasnih prevzemov ISTEGA artikla se ne moreta več preplesti (§21 veriga); previousQty ostane odveden iz post-vrednosti − delta; scope fail-closed R85-4c nespremenjen; dokaz: r209 drill G6 (IT — mešan vnos 201 + procurement 2→5 + scope) + r220-g5-g6 unit |
| G7 | PO receive brez klientega idempotencyKey | receive kanon (_helpers.ts:113-494) — prej: terminal-status guard + cap-check sta edina zavora | dup prevzem z ISTIMI količinami po statusu `partial` + cap povečavi je bil po oblikovanju možen (cap-check edina zavora); poln receive → terminalno stanje → 400 | **ZAPRTA R212** — klientov opcijski `idempotencyKey` na GRN (`@@unique([purchaseOrderId, idempotencyKey])`, schema.prisma:2551); replay check POD `hashtext(poId)` advisory lockom (_helpers.ts:156-180) in PRED terminalnimi zaščitami → retry = 200 ISTI GRN, EN efekt (brez dup zaloga/StockTx/PH/AP); scope ključa je (purchaseOrderId, key) — PO/GRN lokacija nullable (PG NULL ≠ NULL luknja pri (locationId, key)), per-PO lock pokriva replay ISTEGA naročila; P2002 race → 409 retry z istim ključem → replay 200; NULL ključ = legacy bit-for-bit; dokaz: r209 drill G7 (4 IT) + r212-receive-idempotency unit |
| G8 | SupplierPriceHistory NI privzeti COGS basis (samo opt-in) | recipes/route.ts:75-137 (`?priceSource=supplier`) | privzeti food-cost/COGS bere `InventoryItem.costPerUnit/costPerServing` (spot); nova cena ne prepisuje zgodovine (append-only PH + snapshot totalCost na tx) — zgodovinski costing ostaja | BY DESIGN (deklarirano) |
| G9 | `InventoryBatch.unitCost` shranjen, a NE uporabljen v costing | schema.prisma:1295; noben costing path ga ne bere | batch cost basis „pripravlja tla" za morebitno lot-valorizacijo — trenutno ne-povezano | ODPRTA (ne-deklarirana funkcija) |
| G10 | brez avtomatskega expiry write-off joba | batches route samo poroča (`isExpired`, `isExpiringSoon` route :87-115) | pretečene serije poročane; FEFO jih naravno porabi prve; ni cron odpisa | ODPRTA — izrecno ne-implementirano |

---

## 6. Izrecno NE-implementirano (anti-overclaim)

- **Fizična validacija zaloge**: brez fizičnih dokazov se NE trdi (inventura
  dokazuje izključno digitalno verigo count → approve → ledger).
- **Inventurna valorizacija** (moving average / FIFO / lot-costing): NE
  obstaja. COGS je spot-cost model ob odvodu (`InventoryItem.costPerUnit`).
- **Kreditne note / preklic GRN**: shema nosi `GoodsReceipt.status='cancelled'`
  (schema.prisma:2522), a NE obstaja route — zgodovinski prevzemi ostanejo.
- **Sub-recepti (podrepi)**: shema (`RecipeItem.parentRecipeItemId`) obstaja,
  živega razreševanja podreceptov v porabi NI — poraba bere samo direktne
  RecipeItem vrstice.
- **Partial-invoice progress** onkraj `PO.invoiceStatus` ('partial') in
  per-line variance statusov: ni ločenega progress modela.
- **Drugi ledger / drugi recept engine / drugi COGS engine**: IZRECNO
  prepovedano (issue §24) — vse spremembe morajo iti skozi obstoječe kanone §3.

---

## 7. Pokritost testov (repo dokazi)

- **IT (prava PGlite)**: `r209-inventory-chain-drill` (26 — žive verige §4,
  vključno R212 G7 replay dokaz + R214 G4 batch-PUT FEFO/audit dokaz + R216 G2
  business-day bucketiranje dokaz — cross-midnight marža koherentna + R218 G3
  QR odvod dokaz — ključavnice + FEFO po serijah + orderId + 409 roll-back),
  `r130-supplier-price-history`, `r129-reorder-to-po`,
  `r131-supplier-catalog-drill`, `r132-recon-drill` (three-way match +
  „price history NI prepisana").
- **Unit**: r119 waste ledger (W-1..W-6), r121 stocktake, r122 batch
  preparation, r123 yield, r124 sold-out enforcement + public availability,
  r120 batches route + batch-lot-fefo (security), r105 PO receive concurrency
  (PO-1..6), r106 inventory stock concurrency (INV-1..3), r182 stock-lock
  canon, r161 last-2-units, r130/r131 price history + pack size, r129 reorder
  canon, r211 menu-stock location, r212 receive idempotency (key passthrough
  + replay wire), r214 batch-PUT adjust kanon pariteta (ključavnice +
  Serializable + FEFO + audit + scoped re-read + 409), r216 business-day COGS
  bucketiranje (helper + 4 konzumenta where-pini), r218-g3-sale-deduct (4+1
  pisci kanon pariteta — fs-pini lock-ordering, QR orderId/FEFO runtime
  call-order, glovo pre-fetch/N+1, kiosk 5-arg passthrough), lib/yield +
  lib/menu-availability.
- **E2E**: core-flow FLOW-13 (sale tx + zmanjšana zaloga po golden pathu),
  danes-cockpit menu-stock error stanja, observability DB health
  (`db.inventory.negativeCount`).
