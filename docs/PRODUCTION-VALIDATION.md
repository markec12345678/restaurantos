# Produkcijska validacija in forenzični audit

> Issue #124 — "R127 — Production validation + forensic audit po R126"
> Izvedeno v rundah R158-a (READ-ONLY audit) + R158-b (controlled fixes)
> HEAD ob auditu: `19303a53` (= origin/main) · FIX HEAD: glej git log

---

## 1. Namen in metodologija

Issue #124 je nastal med rundama R126/R127 kot opomnik: po Daily Close rundi je treba
dokazati, da je sistem notranje konsistenten (POS → orders → payments → refunds/voids →
cash shifts → Z-report → inventory/COGS → waste → reports → Daily Close → audit) in da
ostajajo varni tenant/location scope, avtorizacija, idempotencija, CAS, concurrency,
business-date/timezone in migracijska integriteta.

Metodologija:

- **R158-a**: READ-ONLY forenzični audit nad aktualnim main (issuejev izvirni HEAD
  `dfdd36ba` je zastarel — od takrat je bilo ~30 rund). Vse trditve podprte z dokazi
  (file:line, test imena, CI run/job ID-ji, API odgovori, ukazi + exit kode).
- **R158-b**: controlled fixes — SAMO dokazane P1 najdbe. Nič ni bilo "popravljeno
  po občutku".
- **Anti-overclaim pravilo** (issue sekcija 16, zavezujoče): nič ni PASS brez dokaza.
  Kjer dokaz ne obstaja, je stanje izrecno označeno (NOT PHYSICALLY VALIDATED /
  UNKNOWN / PARTIAL / backlog).

---

## 2. CI / repository evidence (HEAD `17378592` — osveženo R165)

| Dokaz | Vrednost |
| --- | --- |
| CI run | `36594306924` — **success**, 7/7 jobov (Security Audit, Lint/Typecheck, Build production, Integration real DB, Migration drift, Unit, E2E Security) |
| E2E run | `36594306848` — **success** (Playwright: 226 passed / 4 skipped) |
| CI Monitor | 2× success (`36594881631`, `36595202136`) |
| run_attempt | 1 povsod — NI re-runov, NI rerun-failed-jobs mehanike (playwright `retries: CI ? 2 : 0`) |
| Unit (CI log) | 286 fajlov / **5223** testov + 100 fajlov / **1949** (tests/unit/security) = **7172, 0 skipped** |
| Integration (CI log) | 23 fajlov / **235** testov, 0 skipped |
| E2E Security | **88 passed** |
| Lokalna reprodukcija | vitest run 5223/5223 (286 fajlov), exit 0 — CI count natančen (R164-final ×2 + R165 gates) |
| Production Build | job zelen — edini buildability dokaz (sandbox ne zna graditi) |

Skipped/todo sweep (re-verificirano R165): 15 zadetkov `.skip/.todo/.only` — VSE v
tests/e2e/ (3 permanentni critical-path + 12 pogojnih data-guard: device-tab 1,
furs-financial 2, outbox-worker 3, payment-flow 6); 0 v unit+IT.

> Issuejeva številka "4152 testov" je zastarela (nanaša se na R126-era HEAD).

---

## 3. DailyClose × ZReport state matrica (issue sekcija 3–4)

| DailyClose \ ZReport | DRAFT | FINALIZED |
| --- | --- | --- |
| PENDING_APPROVAL | **VALID** (Z-draft upsert pot; nad pragom) | dosegljiva le prek **approve** poti (zakonita) |
| CLOSED | ~~dosegljiva prek finalize faila~~ → **REPAIRED (R158-1)**: replay preveri dejanski Z in izvede idempotenten re-finalize | **VALID** (kanon) |
| REOPENED | **VALID** (reopen de-finalizira Z v tx) | dosegljiva le prek re-close + approve (zakonita) |

Invarianti: `@@unique(locationId, businessDate)` + `@@unique(locationId, idempotencyKey)`
na DailyClose; CAS `updateMany` prehodi; zgodnji 409 `DAILY_CLOSE_ALREADY_CLOSED`.

**Kritično vprašanje issueja** ("DailyClose=CLOSED + ZReport=DRAFT po uspelem
commitu — možno?"): **DA, bilo je dosegljivo** — finalize teče izven tx. Fast-path replay
je maskiral (poročal `zReportFinalized` iz statusa DailyClose brez preverjanja Z) in ni
bilo samoozdravitvene poti. → **R158-1 [P1], popravljeno** (glej §8).

---

## 4. Business date / Ljubljana timezone (issue sekcija 5)

- Kanonski helper: `src/lib/timezone-sl.ts` (`ljubljanaDayBounds`, `ljubljanaTodayStr`,
  `ljubljanaDateTimeParts`) — 26 konzumentov; jedro finančnega zaključka (daily-close,
  z-report, end-of-day, cash-register) **čisto** na njem.
- Sweep: 78 zadetkov `toISOString().slice(0,10)` / `split('T')` ocenjenih posamično.
  - **Jedro: OK.**
  - **7 P2 rizik mest izven zaključne poti** (finančno-vidni prikazi, ne integriteta
    zaključka): `reports/sales:78`, dashboard comparison/weekly, `tax-report:89/107`,
    `furs e-invoice-book:109/136`, `labor-reports:149–387`, financial/eod privzeti
    datumi → **POPRAVLJENO (R159-b)** — vsa mesta (+ re-sweep bonus: vat route,
    vat time-distribution periodKey, export route) na LJ kanon prek
    `ljubljanaDayBounds`/`ljubljanaDateTimeParts`; meje ekskluzivna LJ polnoč (lt);
    `datumIzdaje` (zakonski datum) po LJ. Zero-migration.
  - P3 ostanki → **POPRAVLJENI (R160-b)**: vat time-distribution daily/weekly/
    monthly vedra, employees/popular/shifts/wallet-payment okna (+wallet stats
    branch r35-luknja), ai/forecast (day-key + YMD oznake), digest družina
    (daily-digest/digest-preview/digest-send/scheduled-emails create+process/
    email dup-check — kanonski reportDate = UTC polnoč LJ dneva, dup-check
    preklopljen v ISTEM editu), loyalty-automation idempotenčni ključi (lock,
    re-check okno, SMS outbox), cash-register webhook daily_report.ready,
    financial N1 time-distribution (tihi izpad mesečnih naročil odstranjen),
    tips heatmap, employees hourly, happy-hour/order-config open-closed,
    send-report-email okno, eDavki XML <Period> = mesec obdobja (ne
    generiranja). DEFER (dokumentirano): api/shifts write-path pariteta,
    tip-pool/actual-times-sync, privzeta okna expenses/staff-performance,
    statistična družina, klient-TZ razred, restaurant-checks toLocaleString-hack,
    e2e workflow startDate (test-infra).
  - Year-boundary testi: p2-ux-formatting.test.ts (letnica 2024→2025 + DST-konec
    2024-10-27 25 h) + trap-DB r159-utc-buckets.test.ts (meje/bucketi per ruta).
- DST/leap pokritost potrjena (p2-ux-formatting.test.ts: 23h/25h dnevi, 22:00 UTC
  začetek CEST dneva, 2024-02-29).

## 5. Financial source-of-truth (issue sekcija 6)

- **Z-report ≡ Daily Close: DOKAZANO isti vir** — oba skozi `upsertZReportForDay →
  calculateReportStats` (isti Ljubljana bounds; paymentStatus ∈ [paid, partial];
  plačila neto refundAmount; storno posebej; `expectedCash` = Σ
  CashRegisterShift.expectedCash = startingCash + cashSales + cashTips).
- COGS: R123 `yieldAdjustedLineCost` = ista RAW osnova kot dedukcija (rawFromUsable) —
  stale vir NI uporabljen.
- **R158-5 [P3], popravljeno (R161)**: `totalRefunds` snapshot v DailyClose je bil
  vedno 0 — `calculateReportStats` zdaj izpostavlja refund agregat (tx-fresh
  `payment.aggregate` na client parametru, Σ refundAmount po kanonu izmene
  `status in [completed, refunded]`, širši order paymentStatus
  `[paid, partial, storno]` — namerna deviacija, dokumentirana v stats.ts; iste
  LJ meje gte/lt; 0 migracij) → route :300 snapshot + export stolpec "Povračila"
  realen. Testi: 9 v r161-totalrefunds.test.ts (where-pin, LJ meje identity,
  tx-klient, S6 neto/bruto pariteta, CSV "12.50" format s piko).

## 6. Inventory / COGS regresija (issue sekcija 7)

Dokazni seznam: yield 20 testov (100/80/50 %); r122 batch (vzporedni complete = ENA
poraba); r120-batch-lot-fefo A1..F1; r106 A1..C4; concurrency-p19 (`inventoryDeducted`
atomic claim → retry ≠ second deduction); r124-soldout 12 testov; invarianta
`needed == deducted`. **R158-6 [P3], pokrito (R161)**: namenski test "sočasna
poraba zadnjih 2 enot" dodan — tests/unit/security/r161-last2-units.test.ts
(V1a: 2 vzporedni porabi po 1 enoti na 2 enotah → obe uspešni, končno točno 0;
V1b: tretja vzporedna na izčrpani zalogi → count=0, 'Premalo zaloge', 0 audit
vrstica, brez oversella; V2: 2 seriji × 1 enota FEFO → stale read + pogojni
guard gte, obe seriji EXHAUSTED). Trap DB pina DEJANSKE produkcije WHERE-pogoje
(gte/lte/inventoryDeducted false→true), ne mock vedenja.

## 7. StaffShift / FURS / izolacija / idempotencija / offline / backup (issue sekcije 8–13)

- **StaffShift (S8)**: `model Shift` ODSOTEN; /api/shifts compat layer (date alias,
  copy_week) z r125 testi; expected cash vir = CashRegisterShift (ne stari Shift).
- **FURS per-location (S9)**: `buildFursConfigFromSettings` (locationId obvezen,
  settings.furs* mrtva) + 14 r125 testov; settings PUT ignorira furs polja
  (:67/:154/:174-177); cert vezan na order.locationId v verify-invoice/storno-invoice.
- **Tenant/location izolacija (S10)**: 11/11 endpointov z guard + negativnim testom
  (99 security test fajlov; e2e MODELA-1..16 + IDEMPO-1..5); QR removed-by-design.
- **Idempotencija/concurrency (S11)**: 6/8 scenarijev s testi; CAS/constraint pattern
  dokazan; finalize retry toleranca + NOVA repair veja (R158-1).
- **Offline (S12)**: orders/cancel **OFFLINE-SAFE** (IndexedDB + ledger exactly-once +
  r128 IT + živi E2E); payment **OFFLINE-BLOCKED** (client guard + 422 — po zasnovi);
  DailyClose **OFFLINE-BLOCKED** de facto (zdaj tudi dokumentirano tu); FURS receipt
  sync **PARTIAL** (mehanika imenovana R166-F7: sw.js POST brez Authorization
  headerja → 401/403 — sync ne teče; batch auth/platformAdminGate kontrakt je
  fail-closed po zasnovi).
- **Backup/restore (S13)**: **PHYSICALLY VALIDATED** v sandboxu (živi 6-fazni drill,
  RTO 22 s; r127 round-trip IT teče v CI) — omejitev: PGlite ≠ Neon.

## 7a. Module readiness matrix (issue sekcija 14) — povzetek

**21 complete** (vsak z route + test + živo/e2e dokazom) · **2 partial**: FURS (koda
complete; živi FURS NI fizično validiran — sim-mode), Offline (payments/DailyClose
blocked po zasnovi) · **1 removed/replaced**: QR (→ /api/public/menu).

---

## 8. Findings register (issue sekcija 15)

| ID | Sev. | Naslov | Status |
| --- | --- | --- | --- |
| R158-1 | P1 | DailyClose CLOSED + Z DRAFT dosegljiv ob finalize failu; fast-path replay maskiral dejansko Z stanje | **FIXAN** — replay preveri dejanski Z (po shranjenem businessDate) in ob napačnem stanju izvede idempotenten re-finalize (isti vzorec kot glavna pot; brez audita/draft upserta/tx); strukturirane napake fail-closed passthrough; `Z_REPORT_FINALIZED` toleriran; nove polji `zReportFinalized` (dejansko) + `zReportReFinalized` (marker, backwards-compatible). Testi: 4 v r126-daily-close.test.ts |
| R158-2 | P1 | Legacy POST /api/z-report (finalize=true) obide DailyClose admin odobritev na PENDING_APPROVAL/REOPENED danu | **FIXAN** — gate pred upsertom: 409 `DAILY_CLOSE_PENDING_APPROVAL` / `DAILY_CLOSE_REOPENED` / `DAILY_CLOSE_ALREADY_CLOSED`; brez DailyClose vrstice legacy 1:1; draft (finalize:false) pot odprta. Testi: 6 v r158-zreport-gate.test.ts |
| R158-3 | P2 | data-retention cron ni registriran v vercel.json | **FIXAN (R163)** — vercel.json vnos NAMERNO ni dodan (dokazan Hobby limit 2 crona — cron_jobs_limits_reached @ 398c24fb, 2/2 zasedena) → registracija prek GitHub Actions data-retention.yml (schedule 0 4 * * *, POST + Bearer CRON_SECRET, plan-neodvisno; issue #139); GET pini 27b/28b v r148 unit; predpogoj: secrets.CRON_SECRET + vars.PROD_URL; na Vercel Pro 1-vrstični vnos (route komentar) |
| R158-4 | P2 | 7 finančno-vidnih UTC-bucket mest (e-invoice-book datumIzdaja, tax-report, reports/sales, dashboard, labor, financial/eod privzeti) | **FIXAN (R159-b)** — 10 mest (7 + vat route/time-distribution/export re-sweep) na LJ kanon; year-boundary + trap-DB testi; **P3 ostanki FIXANI (R160-b)** — 17 mest (7 P3 + N1–N8 re-sweep, vključno tihi izpad mesečnih naročil v financial grafu + eDavki XML Period); DEFER seznam dokumentiran |
| R158-5 | P3 | DailyClose `totalRefunds` snapshot vedno 0 → export "Povračila" napačen | **FIXAN (R161)** — refund agregat v calculateReportStats (tx klient = R110 ZR-2, LJ meje, kanon izmene); 9 testov r161-totalrefunds.test.ts |
| R158-6 | P3 | Ni namenskega "sočasni zadnji 2 enoti" testa | **FIXAN (R161)** — r161-last2-units.test.ts (V1a/V1b/V2, DB-pogojni guard pini) |
| R163-S1 | P2 | scheduled-emails/process: registrirani Vercel cron (0 2) pošilja GET, GET pa je stats-only z requireAuth(admin)+platformAdminGate brez CRON_SECRET poti → cron dobi 401, email processing prek Vercel Crona verjetno NE teče | **FIXAN (R164)** — opcija 1 iz issue #140: ločen cron path `/api/cron/scheduled-emails-process` z GET===POST delegacijo na POST obdelavo (vzorec outbox :18-20); vercel.json vnos 0 2 PREUSMERJEN (ostane 2/2 Hobby cron mest); stats kontrakt GET /api/scheduled-emails/process nespremenjen (R85-4c + R160 pini nedotaknjeni); pini r164 unit: vercel.json registracija + maxDuration, 401 fail-closed, cron GET 200 + obdelava, lokacijski admin 403, GET===POST pariteta |
| R166-F1 | P2 | FURS batch: `instanceof Buffer` je zavrnil string PEM (primarna OpenSSL pot loaderja vrača string) → generateZOI brez ključa (prod: throw, test: neskladen SHA-256 fallback ZOI) + manjkajoč ensureDecrypted — latentno, izbruhne ob sim→real | **FIXAN (R166)** — union `string \| Buffer \| undefined` skozi configCache + processBatchReceipt (single-path pariteta verify-invoice :161-182) + ensureDecrypted na batch geslu; 3 passthrough pina (r166-batch-key) |
| R166-F2 | P2 | src/lib/env.ts mrtev sloj — superRefine "FURS_ALLOW_SIMULATION v produkciji" se nikoli ne izvede (0 importov v src/ in tests/) | **DOCUMENT (R166)** — fajl-header opomba (NI se zanašati na ta sloj); živi guardi: server.js:17-33 + boot-guard.ts (health detailed); priklop prek instrumentation = ločena odločitev |
| R166-F3 | P3 | health checkFurs bere FURS_ENVIRONMENT, koda/dokumentacija konfigurirata FURS_ENV → furs check skozi dokumentirano konfiguracijo vedno not_configured | **FIXAN (R166)** — tolerantno `FURS_ENV ?? FURS_ENVIRONMENT` + detail tekst; r96 regresija zelena (pina statusa, ne tekst) |
| R166-F4 | P3 | Storno sim asimetrija: FURS_ALLOW_SIMULATION=true → storno IZVEDEN, stornoReceipt fiscalVerified=true (namerna "Test 5.3" izjema) — nepinana | **PINAN (R166)** — T4/T5 v r166-sim-mode (z flagom: izveden + success=true; brez: 400 + FURS_STORNO_FAILED + zero transakcije); obnašanje nespremenjeno |
| R166-F5 | P3 | Sim EOR generiran a zavrnjen (failResponse eor:'', DB nikoli ne vidi vrednosti) + mrtva "(SIMULACIJA)" success veja | **RAZREŠEN (R166, 2. iteracija)** — propagacija eor-ja v odgovor je bila implementirana in **VRNJENA**: E2E kontrakt core-flow.spec.ts :288/:310 pina response.eor === DB/preview.eor ("V simulaciji EOR ostane prazen"); končno stanje = dokumentiran kontrakt (core.ts komentar) + sim EOR ostane result-internen; mrtva veja dokumentirana (obrambna) |
| R166-F6 | P3 | generateFursVerificationUrl hardkodira prod validator URL (tudi za test okolje), 0 klicalcev | DEFER — mrtvi helper; pri morebitnem brisanju/priklopu odločiti o URL strategiji |
| R166-F7 | P3 | sw.js FURS Background Sync POST brez Authorization headerja → 401/403 (sync funkcionalno mrtev) + hipotetično pobere celoten queue brez per-receipt preverjanja | DEFER — skladno z "FURS receipt sync PARTIAL" (§7 S12, mehanika sedaj imenovana); SW auth = ločen obseg |
| R166-F8 | P3 | FURS cert gesla se pišejo PLAINTEXT (ensureEncrypted 0 klicalcev; .env.example trditev o AES-256-GCM ne drži za FURS polja) | DEFER — pred sim→real: šifriranje write-path (locations POST/PUT) ALI popravek .env.example trditve |
| R166-F9 | P3 | Drobnarije: (a) .env.example FURS_ALLOW_SIMULATION komentar obrnjena formulacija, (c) zoi.ts hint "FURS_ENVIRONMENT=test" ne-obstoječa varjanta; (b) route.ts:92-94 URL duplikat, (d) checklist:31 brez cross-ref na README:532 | **FIXANI (R166): a + c; DEFER: b + d** |

---

## 9. Anti-overclaim izjava (issue sekcija 16)

- "Production-ready" NI trženo — zelen CI je dokaz konsistentnosti, ne produkcijske
  zrelosti; FURS ostaja sim-mode (NOT PHYSICALLY VALIDATED z realnim FURS okoljem).
- "Backup works" je trženo SAMO z restore dokazom (živi drill + CI round-trip).
- "Offline works" velja SAMO za orders/cancel (exactly-once dokazan); payment in
  Daily Close so po zasnovi offline-blokirana.
- Test count je preverjen iz CI logov (ne samo commit claim).

## 10. Definition of Done (issue sekcija 17)

HEAD audit ✅ · CI evidence ✅ · E2E evidence ✅ · dejanski test count ✅ · Daily Close
forenzika ✅ · state matrica ✅ · finalize failure scenarij (testiran + popravljen) ✅ ·
timezone audit ✅ · financial source-of-truth ✅ · R123/R124/R125 regresije (dokazane
z obstoječimi testi) ✅ · tenant/location izolacija ✅ · idempotencija ✅ ·
concurrency ✅ · offline/reconnect status ✅ (dokumentiran, ne PASS vse) ·
backup/restore status ✅ (physically validated v sandboxu) · module matrix ✅ ·
findings P0/P1/P2/P3 ✅ (P1 fixana) · naslednji task ✅ (R158-4).

**Zaklep epika (R162)**: evidence osvežena na HEAD `98925c08` (CI 7/7 + E2E + 2×
Monitor, vse attempt=1; unit 7164 iz CI logov; IT 235). R159 (R158-4), R160 (P3
ostanki + N1–N8) in R161 (R158-5 + R158-6) izvedeni — findings register (§8) zaprt
razen FURS fizične validacije (realno okolje, izven sandboxa). Epik #115
formalno zaprt v R162; parked scope je dokumentiran v zaključnem komentarju epika.
**Dodatek (R163)**: R158-3 FIXAN — registracija prek GitHub Actions data-retention.yml
(schedule 0 4 * * *, plan-neodvisno; vercel.json vnos zavrnjen zaradi dokazanega
Hobby limita 2 crona @ 398c24fb). NOV finding R163-S1 (scheduled-emails/process
GET stats-only → registrirani cron 0 2 verjetno ne procesira; issue #140, [ANALIZA]).
**Dodatek (R164)**: R163-S1 FIXAN — ločen cron path `/api/cron/scheduled-emails-process`
(GET===POST delegacija po outbox vzorcu), vercel.json vnos 0 2 preusmerjen (2/2 Hobby
mest ohranjena); dashboard stats kontrakt ostaja nespremenjen (issue #140 zaprt).
**Dodatek (R166)**: FURS sim-mode validacija poglobitev (forenzični audit R166-a, 9
findings). FIX: R166-F1 (batch ZOI ključ union + ensureDecrypted), R166-F3 (health
FURS_ENV tolerantno); R166-F5 RAZREŠEN v 2. iteraciji (propagacija VRNJENA na
E2E kontrakt dokaz core-flow :310 — dokumentacija namesto spremembe); PIN:
R166-F4 (storno sim asimetrija); DOCUMENT: R166-F2 (env.ts mrtev sloj),
R166-F9a/c; DEFER: R166-F6/F7/F8.
NOVI testi: r166-sim-mode (5), r166-batch-key (3), r166-timezone-dst (5). Anti-overclaim
ostaja: FURS je koda-complete + sim-mode strukturno validiran, **NOT PHYSICALLY
VALIDATED** z realnim FURS okoljem (mTLS/JWS/EOR — §7 točka 7).
