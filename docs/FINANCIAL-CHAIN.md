# FINANCIAL-CHAIN — Financial Integrity & Reconciliation (issue #151 §3)

> 📌 ROKO-PINIRAN dokument (epik #144 + issue #151, R205) — drift-gate:
> `tests/unit/lib/r151-financial-chain-pins.test.ts` (sidra na realne
> kanonske datoteke; sprememba kontrakta brez posodobitve dokaza = rdeč test).
> Strukturna veriga navzkrižno z **GENERIRANO** `docs/BUSINESS-CHAIN.md`
> (14 dejstev, 74 writerjev — tukaj je le finančni pogled z
> reconciliacijskimi pravili in vrzelmi).
>
> **ONE ECONOMIC EVENT → ONE AUTHORITATIVE FINANCIAL EFFECT**
> ORDER → PAYMENT → RECEIPT → FISCALIZATION → SHIFT → Z → EOD → REPORT

**Status dokazovanja (R205, korak 1):** Order→Payment del verige ima repo-backed
integracijske dokaze (`tests/integration/r151-financial-chain-drill.test.ts` —
realni route handlerji na realni PGlite bazi). Receipt→FURS→Shift→Z→EOD del je
strukturno piniran (BUSINESS-CHAIN + R110/R185 kanoni); njegova *živa* reconciliacijska
drila so **#151 korak 2 (R206)**.

---

## 1. Matrica finančne resnice (#151 §3 — 16 dejstev)

Legenda stolpcev: **Reconciliation rule** = invarianta, ki jo mora vsak
kontrolirani poslovni dogodek zadoščati; **Evidence** = obstoječi dokaz;
**Gap** = znana vrzel (izrecno, nikoli tiho).

| Financial fact | Canonical source of truth | Writers | Readers | Snapshot/derived value | Reconciliation rule | Existing evidence | Gap |
|---|---|---|---|---|---|---|---|
| Order subtotal | `OrderItem.price × quantity` (P1-8 celovod) | orders POST/add-items, mobile, kiosk, online | reports, dashboard | `Order.subtotal` Decimal(12,2) agregiran ob kreaciji | Σ OrderItem(osnova) == Order.subtotal | P1-8 unit (`tests/unit/orders/p1-data-model.test.ts`), R151 IT (1) | — |
| Order total | `calculateOrderTotals` (neto + DDV − popust) | isti kot subtotal | cash-register, payments | `Order.total` Decimal(12,2); tip NI v total (doda se v totalWithTip) | Order.total == Σ Check.total (per order) | R151 IT (1)+(3) | — |
| Modifier amount | `Modifier.price` (DB) | menus, orders | receipts (vrstice) | `OrderItemModifier.price` join snapshot + legacy `modifiersJson` string | cena postavke == osnova + Σ DB modifier cen (client cena samo fallback) | FIX BUG-13, R151 IT (1) | — |
| Discount | `Check.discount` / `OrderItem.discountAmount` | checks POST (appliedDiscount), orders POST (order-level) | reports | proporcionalna porazdelitev po postavkah, zadnja dobi ostanek (cap na subtotal) | Σ item discount == order discount; popust ≤ subtotal | P1-8 unit (cap/proporcija) | — |
| Tax | `OrderItem.vatAmount` (po postavki, ROUND_HALF_UP 2dp) | orders (P1-8) | receipts (`calculateVatBreakdownForReceipt`), Z | `Check.tax`, `Receipt` VAT breakdown snapshot | Σ item VAT == Order.tax == Check.tax (brez servisnih postavk) | P1-8 unit, R151 IT (1) | — |
| Payment amount | `Payment.amount` (Decimal 12,2) | payments POST, qr-pay | check-status, shifts, Z | refundAmount ločen (storno NI brisanje) | Σ completed payments ≤ Check.total + ε(0.01); paid ⟺ ≥ total − 0.01 | R116, R151 IT (3)+(4) | — |
| Payment method | `Payment.type` (cash/card/mobile/voucher/loyalty/giftcard/alternate) | isti | shifts (cashSales/cardSales), Z | Order.paymentMethod = single type ali 'split' (derivacija) | method totals → shift totals → Z (ISTI vir: Payment vrstice) | R185/R110 kanoni; R151 IT (3a) | — |
| Payment status | `Check.paymentStatus` (unpaid/partial/paid/storno) | payments (updateCheckAndOrderStatus), refund (R183 kanon) | POS UI, danes | Order.paymentStatus/paidAt deriviran | paidAt ≠ null ⟺ derived == paid; R183 netPaid (Σ − refundAmount) | R183 drift-gate, R151 IT (3a) | — |
| Receipt total | `Receipt.total` snapshot ob izdaji | receipts POST, CIS submission | digital-receipt, FURS | VAT breakdown + per-location številčenje | Receipt.total == Check.total ob izdaji (historical: nespremenljiv) | Golden Path E2E | **korak 2 (R206): živi IT drill Order→Payment→Receipt na cent** |
| Fiscal total | `Receipt.total` + `zoi`/`eor` (FURS) | furs sync verify, batch, async outbox | e-invoice-book | zoi/eor/fiscalVerified pisci (outbox skipa če eor obstaja) | fiscal total == receipt total; duplicate submission zaščiten | FURS unit/security testi | **SIMULIRANO — produkcija NE validirana (FURS cert = uporabniški korak, #141)** |
| Shift sales | `CashRegisterShift.totalSales` | cash-register POST/PUT, EOD close | danes, reports | cashSales/cardSales/totalSales | shift totals == Σ settled payments v oknu smene (isti Payment vir) | R185 CAS kanon | **korak 2: živi drill smena zaključena → Z** |
| Cash sales | `CashRegisterShift.cashSales` | isti | Z, EOD | deriviran iz Payment.type='cash' | cashSales == Σ cash payments (settled) | R185 pin | korak 2 |
| Card sales | `CashRegisterShift.cardSales` | isti | Z, EOD | deriviran iz Payment.type='card' | cardSales == Σ card payments (settled) | R185 pin | korak 2 |
| Cash difference | `CashRegisterShift.cashDifference` | shift close (R185 kanon) | Z, EOD | actual − expected closing cash | izključno iz avtoritativnih vrednosti (ni ročno-ureljiv vir) | R185 drift-gate (13 testov) | korak 2 |
| Z-report total | `ZReport` (R110 upsert kanon, advisory lock `z-report:<loc>:<date>`) | z-report upsert, EOD | reports/eod | CAS `{ status: { not: 'finalized' } }` | Z == zaključena smena ob zaključku; ponovna finalizacija zavrnjena | R110 concurrency IT | **korak 2: živi drill Z ↔ closed shift** |
| EOD revenue | `DailyClose` (snapshot pariteta) | daily-close, eod-close | analytics | snapshot ob odobritvi | EOD == Σ Z/dnevnih dogodkov (pariteta snapshotov, vsak z LASTNO semantiko) | R126 daily-close testi | korak 2 |

## 2. Ključna reconciliacijska pravila (repo kanoni)

1. **Klient NI avtoritativni vir zneskov** (#151 §4): `createOrderSchema` NIMA
   `total/subtotal/tax` polj; `OrderItemInput.price` je opcijski wire-polje, ki ga
   račun NIKOLI ne uporabi — cena vedno iz DB (`MenuItem.price` + DB modifier cene,
   FIX BUG-13). Checks: *"Zneski se izračunajo strežniško iz povezanih OrderItem-ov"*.
   → Drži tudi za split payments: client pošilja zgolj `amount` dele, ki jih
   overpayment guard omeji na `remaining + 0.01`.
2. **Zgodovinski snapshot stabilen** (#151 §5, scenarij F): OrderItem snapshot polja
   (`price/vatRate/vatAmount/menuItemName`) so persistirana ENKRAT ob kreaciji;
   sprememba master cene kasneje NE prevračuna zgodovinskih transakcij (ni menu
   versioning modela — deklarirano). Dokaz: R151 IT (2).
3. **ε prag 0.01 = reconciliacijski kanon** (#151 §7/§9): ISTI prag na obeh straneh —
   overpayment guard (`amount > remaining + 0.01` → 400) in paid derivacija
   (`Σ >= total − 0.01` → paid). Symetrija je namerna in pinirana.
4. **En finančni efekt** (#151 §9): Payment.idempotencyKey `@unique` + P2002 replay =
   isti payment (R116); replay request → 200 z ISTIM id (dokaz R151 IT (4a));
   ALREADY_PAID → 409 brez efekta (R151 IT (4c)).
5. **Storno ≠ brisanje** (#151 §20): `Payment.refundAmount` + R183 enoten reversal
   kanon (`recalcCheckAndOrderStatusAfterReversal`); Check FK Restrict ohrani sled.
6. **Biznis dan = Europe/Ljubljana** (#151 §17): kanon `src/lib/timezone-sl.ts`
   (`ljubljanaDayBounds`/`ljubljanaTodayStr`) — R204 piniral `/api/operational-alerts`
   in DanesCockpit; finansčna agregacija po poslovnem dnevu (shift/Z/EOD) uporablja
   iste meje (#148 + #151 delita implementacijo, ni klonov).
7. **Pisalni ključavni grafi** (A2/A3/A6/A7 rešeni): order-write → checkId → payment
   enosmerno (R181/R109); shift close = CAS kanon (R185); Z = advisory upsert (R110);
   inv-stock = sorted locki (R182).

## 3. Vrzeli (izrecno, vsaka s lastnikom)

- **§18 float akumulacija v `calculateCheckAmounts`** (`src/app/api/checks/_helpers/calculate.ts`):
  check pot še akumulira `subtotal += itemBase` v JS float, medtem ko P1-8 kanon
  pravi "vsa aritmetika gre skozi Prisma.Decimal". Zaščita: vsi vhodi so 2dp vrednosti
  in R181 recalc piše skozi `round2(...)` na pisalni meji — pri realističnih
  velikostih (< 10^12, 2dp vhodi) ni opaženega odmika. **Klasifikacija: kanon-divergenca,
  NE potrjen defekt (ni demonstriranega napačnega izpisa). Fix: #151 korak 2 (R206) —
  migracija na Decimal + float↔Decimal parity dokaz + osvežitev R181 pinov.**
- **§11 Receipt reconciliacija na živi bazi**: strukturno pinirana (BUSINESS-CHAIN
  'receipt'), živi drill Order→Payment→Receipt→total na cent = **R206**.
- **§12 FURS meja**: SIMULIRANO — produkcija NE validirana (certifikat sd.fu@gov.si =
  uporabniški korak, #141). Nikoli ne nadgraditi simulacije v produkcijsko trditev.
- **§13/§15/§16 Shift→Z→EOD živi drila**: kanoni obstajajo (R185/R110/R126), živi
  end-to-end reconciliacijski drill = **R206**.
- **§28 Browser evidence**: nov issue-specifičen dokaz (posnetki stanja po plačilu,
  refresh/retry) = **R206** (ne uporabljati starih posnetkov).

## 4. Kanonske datoteke (fail-closed sidra)

- `src/app/api/orders/_helpers/order-items.ts` — P1-8 izračun celovod (Decimal, DB cene)
- `src/app/api/payments/_helpers/create-payment.ts` — overpayment ε guard + idempotency
- `src/app/api/payments/_helpers/check-status.ts` — paid/partial derivacija + split method
- `src/lib/cash-shift/close-shift-canon.ts` — R185 CAS shift close kanon
- `src/app/api/z-report/_helpers/upsert-z-report.ts` — R110 Z upsert kanon (advisory lock)
- `src/app/api/checks/_helpers/transaction.ts` — R181 check recalc kanon (total formula)
- `src/app/api/checks/_helpers/calculate.ts` — §18 znana vrzel (float akumulacija)
- `src/lib/timezone-sl.ts` — #151 §17 biznis-dan kanon (Europe/Ljubljana)

## 5. Anti-overclaim

- Ta dokument je **strukturna verifikacija + repo-backed IT dokazi na (1)+(2)+(3)+(4)
  obsegu** — **NE produkcijska validacija** (dokazni kanali = VALIDATION-MATRIX §8;
  zelen CI ≠ produkcijska validacija).
- vsak "SIMULIRANO" ostane simulirano; "NE validirano" ostane nevalidirano, dokler
  ne obstane NOV dokaz (runda + datoteka + test ali realen dogodek).
