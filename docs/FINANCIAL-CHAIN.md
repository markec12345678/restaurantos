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

**Status dokazovanja (R207, korak 2):** Order→Payment→Receipt→FURS(sim)→Shift→Z→EOD
veriga ima repo-backed integracijske dokaze (`tests/integration/r151-financial-chain-drill.test.ts`
+ `tests/integration/r207-fiscal-chain-drill.test.ts` — realni route handlerji na realni
PGlite bazi, §26 checkpointi 1–8). §18 Decimal divergenca je migrirana (korak 2);
§23 failure matrica je spodaj izpolnjena iz implementacije; §28 browser evidence
(`tests/e2e/r151-settlement-recovery.spec.ts`). FURS meja ostaja SIMULIRANA —
produkcija NE validirana (§12, certifikat = uporabniški korak, #141).

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
| Receipt total | `Receipt.total` snapshot ob izdaji | receipts POST, CIS submission | digital-receipt, FURS | VAT breakdown + per-location številčenje | Receipt.total == Check.total ob izdaji (historical: nespremenljiv) | Golden Path E2E + **R207 IT CKPT 3 (+ §24.10 duplicate → ISTI račun)** | — |
| Fiscal total | `Receipt.total` + `zoi`/`eor` (FURS) | furs sync verify, batch, async outbox | e-invoice-book | zoi/eor/fiscalVerified pisci (outbox skipa če eor obstaja) | fiscal total == receipt total; duplicate submission zaščiten | FURS unit/security testi | **SIMULIRANO — produkcija NE validirana (FURS cert = uporabniški korak, #141)** |
| Shift sales | `CashRegisterShift.totalSales` | cash-register POST/PUT, EOD close | danes, reports | cashSales/cardSales/totalSales | shift totals == Σ settled payments v oknu smene (isti Payment vir) | R185 CAS kanon + **R207 IT CKPT 6** | — |
| Cash sales | `CashRegisterShift.cashSales` | isti | Z, EOD | deriviran iz Payment.type='cash' | cashSales == Σ cash payments (settled) | R185 pin + **R207 IT CKPT 6** | — |
| Card sales | `CashRegisterShift.cardSales` | isti | Z, EOD | deriviran iz Payment.type='card' | cardSales == Σ card payments (settled) | R185 pin + **R207 IT CKPT 6** | — |
| Cash difference | `CashRegisterShift.cashDifference` | shift close (R185 kanon) | Z, EOD | actual − expected closing cash | izključno iz avtoritativnih vrednosti (ni ročno-ureljiv vir) | R185 drift-gate (13 testov) + **R207 IT CKPT 6 (difference == 0)** | — |
| Z-report total | `ZReport` (R110 upsert kanon, advisory lock `z-report:<loc>:<date>`) | z-report upsert, EOD | reports/eod | CAS `{ status: { not: 'finalized' } }` | Z == zaključena smena ob zaključku; ponovna finalizacija zavrnjena | R110 concurrency IT + **R207 IT CKPT 7 (+ §24.15 retry)** | — |
| EOD revenue | `DailyClose` (snapshot pariteta) | daily-close, eod-close | analytics | snapshot ob odobritvi | EOD == Σ Z/dnevnih dogodkov (pariteta snapshotov, vsak z LASTNO semantiko) | R126 daily-close testi + **R207 IT CKPT 8** | — |

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

- **§11 Receipt reconciliacija na živi bazi: ZAPRTO R207** — živi drill
  Order→Payment→Receipt→total na cent = `tests/integration/r207-fiscal-chain-drill.test.ts`
  (CKPT 3 + §24.10 duplicate receipt → ISTI račun).
- **§12 FURS meja**: SIMULIRANO — produkcija NE validirana (certifikat sd.fu@gov.si =
  uporabniški korak, #141). Nikoli ne nadgraditi simulacije v produkcijsko trditev.
  R207 drill to deklarira: simulacijska overitev ostane `fiscalVerified=false`
  (fail-closed kanon, §29 label disciplina) — dokaz R207 IT CKPT 4.
- **§13/§15/§16 Shift→Z→EOD živi drila: ZAPRTO R207** — živi end-to-end
  reconciliacijski drill (CKPT 5–8: open shift → close → totals == Σ payments →
  EOD → Z finalized → retry zavrnjen → EOD report odraža transakcijo) =
  `tests/integration/r207-fiscal-chain-drill.test.ts`.
- **§18 float akumulacija: MIGRIRANO R207** — `calculateCheckAmounts`
  (`src/app/api/checks/_helpers/calculate.ts`) zdaj akumulira v `Prisma.Decimal`
  (kanon P1-8: "vsa aritmetika gre skozi Prisma.Decimal"); pisalna meja ostane
  zaščitena z `round2(...)` v R181 recalc kanonu. Float↔Decimal parity dokaz:
  `tests/unit/lib/r151-financial-chain-pins.test.ts` (§18 parity blok).
- **§23 Failure/Recovery matrica: IZPOLNJENA R207** (§4 spodaj) — iz
  implementacije, vsaka vrstica z repo dokazom.
- **§28 Browser evidence: ZAPRTO R207** — nov issue-specifičen dokaz
  (`tests/e2e/r151-settlement-recovery.spec.ts`): refresh po naselitvi,
  retry brez dvojnega finančnega efekta; stari posnetki NISO uporabljeni.

## 4. §23 Failure / Recovery matrica (#151 korak 2 — izpolnjena iz implementacije)

Legenda: **Avtoritativno stanje** = DB stanje po napaki (fail-closed); **Retry**
= dovoljena/mehanizirana pot ponovitve; **Dokaz** = repo datoteka s testom.

| Failure | Avtoritativno stanje | Klient | Retry | Dokaz |
|---|---|---|---|---|
| Payment 401 | brez plačila (requireAuth gate PRED body) | 401 | prijava → ponovitev | `tests/unit/security/*payments*` (route pin) |
| Payment 403 | brez plačila (permission manage_cash) | 403 | pravice → ponovitev | auth-middleware pariteta testi |
| Payment 409 ALREADY_PAID | plačan ček NE dobi drugega plačila (0 efekt) | 409 | N/A — stanje je že končno | R151 IT (4c) |
| Payment 429 | brez plačila (rate limit kvota PRED tx) | 429 + Retry-After | po oknu | R112 RL-2 kanon (`rate-limit/presets`) |
| Payment 500 | tx rollback — ni delnih stanj (`db.$transaction`) | 500 | idempotency replay | create-payment kanon |
| Payment timeout | plačilo COMMITano; klient ne ve | neznano → poizvedba | ISTI idempotencyKey → 200 ISTI payment | R151 IT (4a), R116 |
| Duplicate request (ISTI key) | EN plačilni efekt (`Payment.idempotencyKey @unique` + fast-path) | 200 ISTI id | varna ponovitev | R151 IT (4a) |
| Duplicate callback (qr-pay) | EN efekt (isti create-payment kanon + idempotencyKey) | 200 ISTI id | varna ponovitev | qr-pay uporablja create-payment |
| Receipt failure / duplicate | EN račun (obstoječ → 200 ISTI račun, ne 201) | 200 ISTI račun | varna ponovitev | R207 IT §24.10 |
| FURS temporary failure | `fiscalVerified=false, fiscalStatus='pending'` + audit FURS_VERIFY_FAILED | 400 + X-Fiscal-Warning | manualni retry / batch outbox | R207 IT §24.11/12 |
| FURS permanent failure | ostane pending — nikoli lažno overjeno; EOD `furs.failed>0`, alerts števec | 400 | batch outbox (48h kanon) | R207 IT §24.13 + unfiscalized alert |
| FURS duplicate submission | EN fiskalni efekt: CAS claim (`fiscalStatus 'verifying'`) + skip če eor; NI dvojnega EOR | 409 in-flight / 200 idempotent | varna ponovitev | R111 kanon + R207 IT §24.13 |
| Shift close retry | CAS `closeShiftCasIfOpen`: 2. close → 400, agregati NE prepisani | 400 SHIFT_ALREADY_CLOSED | N/A — izmena je zaprta | R185 + R207 IT §24.14 |
| Z finalization retry | advisory lock + CAS `{ status not finalized }` → 400 Z_REPORT_FINALIZED | 400 | N/A — poročilo je žigosano | R110 + R207 IT §24.15 |
| Browser refresh after settlement | UI re-READS avtoritativno stanje (brez re-POST) — ni dvojnega efekta | 200 sveži podatki | refresh = branje | R207 §28 E2E (`r151-settlement-recovery.spec.ts`) |

§24 injection pokritost (implementirana podmnožica, vsak z dokazom): 1 invalid
amount (zod min), 2 wrong order (checkId scope), 3 unauthorized (401), 6 duplicate
payment (R151 IT 4a), 10 failed receipt creation (R207 IT §24.10), 11/12 delayed+
retry FURS (R207 IT §24.11/12), 13 duplicate FURS (R207 IT §24.13), 14 shift close
retry (R207 IT §24.14), 15 Z finalize retry (R207 IT §24.15), 17/18 rounding edge
+ split rounding (R151 IT §7/§9 + R207 parity blok), 20 browser refresh (R207 §28
E2E). NISO implementirani v repotu (izrecno): 4 wrong location preko callbacka,
5 wrong tenant callback, 7/8 provider timeout replika, 9 duplicate provider
callback na živi gateway, 19 refund failure — ker nič od tega ne obstaja kot
produkcijska pot (qr-pay teče skozi ISTI create-payment kanon; zunanji gateway
ni v repotu).

## 5. Kanonske datoteke (fail-closed sidra)

- `src/app/api/orders/_helpers/order-items.ts` — P1-8 izračun celovod (Decimal, DB cene)
- `src/app/api/payments/_helpers/create-payment.ts` — overpayment ε guard + idempotency
- `src/app/api/payments/_helpers/check-status.ts` — paid/partial derivacija + split method
- `src/lib/cash-shift/close-shift-canon.ts` — R185 CAS shift close kanon
- `src/app/api/z-report/_helpers/upsert-z-report.ts` — R110 Z upsert kanon (advisory lock)
- `src/app/api/checks/_helpers/transaction.ts` — R181 check recalc kanon (total formula)
- `src/app/api/checks/_helpers/calculate.ts` — §18 Decimal akumulacija (R207 migracija)
- `src/lib/timezone-sl.ts` — #151 §17 biznis-dan kanon (Europe/Ljubljana)

## 6. Anti-overclaim

- Ta dokument je **strukturna verifikacija + repo-backed IT dokazi na (1)+(2)+(3)+(4)
  obsegu** — **NE produkcijska validacija** (dokazni kanali = VALIDATION-MATRIX §8;
  zelen CI ≠ produkcijska validacija).
- vsak "SIMULIRANO" ostane simulirano; "NE validirano" ostane nevalidirano, dokler
  ne obstane NOV dokaz (runda + datoteka + test ali realen dogodek).
