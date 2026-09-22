# RestaurantOS v1.16.0

[![Version](https://img.shields.io/badge/version-1.16.0-86702b?style=flat-square)](https://github.com/markec12345678/restaurantos/releases)
[![License](https://img.shields.io/badge/license-AGPL--3.0%20%2B%20Commercial-blue?style=flat-square)](LICENSE)
[![Security](https://img.shields.io/badge/security-A%2B%2B-3c7a50?style=flat-square)](SECURITY.md)
[![CI](https://img.shields.io/badge/CI-7%2F7%20%2B%20E2E_210%2F210-green-3c7a50?style=flat-square)](https://github.com/markec12345678/restaurantos/actions)
[![Tests](https://img.shields.io/badge/tests-3500%20unit%20%2B%209%20integracija%20%2B%20210%20E2E-3c7a50?style=flat-square)](tests/)
[![Audit](https://img.shields.io/badge/razvoj-99%20QA%20rund%20complete-426990?style=flat-square)](docs/FINAL-SUMMARY.md)
[![Design](https://img.shields.io/badge/design-Toast%2FSquare%20patterns-3c7a50?style=flat-square)](docs/DESIGN-IMPROVEMENTS.md)

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-black?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-336791?style=flat-square&logo=postgresql)](https://neon.tech/)
[![Tailwind](https://img.shields.io/badge/Tailwind-CSS%204-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Hosted-black?style=flat-square&logo=vercel)](https://vercel.com/)
[![Sentry](https://img.shields.io/badge/Sentry-Monitoring-362D59?style=flat-square&logo=sentry)](https://sentry.io/)

[![FURS](https://img.shields.io/badge/FURS-Ready_(cert_pending)-a98846?style=flat-square)]()
[![CIS](https://img.shields.io/badge/FINA_HR-ZKI_%2B_XML--dsig_živo-171796?style=flat-square)]()
[![PWA](https://img.shields.io/badge/PWA-Offline--capable-5A0FC8?style=flat-square&logo=pwa)]()
[![i18n](https://img.shields.io/badge/i18n-5%20languages-86702b?style=flat-square)]()
[![Multi-tenant](https://img.shields.io/badge/architecture-multi--tenant-426990?style=flat-square)]()
[![GDPR](https://img.shields.io/badge/GDPR-Compliant-3c7a50?style=flat-square)]()

> Pilot-ready POS sistem za restavracije z dvojnim fiskalnim stikalom **FURS (SI) + FINA (HR)**, offline delovanjem, AI napovedmi in multi-tenant arhitekturo. **Security closure po rundi 102**: 18 rund hardeninga (R85–R102) zaključenih z dokazi in regresijskimi testi — tenant scope vali (dashboard, delivery-tracking, reports/*, wallet), M2 fail-open razred izkoreninjen, per-location ordering tokene z revokacijo, delivery webhook envelope, eradikacija vseh anonimnih globalnih fallbackov (P0-C3B kanon), 429 rate-limit kanon na 100 % API površine, dvostopenjska prijava (employeeId binding + javen employees grid + Toast/Square UI + admin binding naprave) in Table.status='reserved' DB flip na rezervacijskem lifecycle-u, deploy forenzika (health → { version, commit }), WebAuthn/passkey device attestation fundacija z prijavno integracijo ("Prijava s ključem naprave" na vezani napravi); full-suite E2E (210 testov / 15 specov, vključno z virtual authenticator FIDO2 ceremony) zelen v CI na realnem PostgreSQL. Glej [Security Policy](SECURITY.md), [Final Summary](docs/FINAL-SUMMARY.md) in [Production Readiness](docs/PRODUCTION-READINESS-CHECKLIST.md).

### 🔒 Hardening v v1.16.0 (QA runde 85–102 — tenant scope kanon + ordering tokeni + 429 kanon + dvostopenjska prijava + deploy forenzika + WebAuthn fundacija + E2E v CI + Prisma query validacija + WebAuthn prijava + atomarni counter guard + multi-origin allowlist + koncurenčni WRITE tokovi)

| Runda | Fokus | Ključni rezultati |
|-------|-------|-------------------|
| **R85** | Tenant scope val: dashboard + delivery-tracking (HIGH) | Globalni P&L/analytics helperji + delivery-tracking (read **in** WRITE čez tenant-e — GPS/status/voznik) scoped; MEDIUM vali (kitchen, reservations, waitlist, time-off, staff-availability, labor-reports, tracking, reorder, gift-cards/inventory žig, scheduled-emails gate) + FINAL val 2 (expenses, guests, mobile-loyalty, mobile-menu, checks discount) + backfill skripta (92 src fajlov, +1600/−428) |
| **R86** | M2 sistemski razred zaprt | Raw fail-open `session?.locationId ?? undefined/null` cenzus 114 zadetkov/77 fajlov → 61; public/kiosk POST fail-closed (explicit locationId obvezen), promo-check, 11 carry-over endpointov, loyalty residuals; 7 novih testnih fajlov (198 testov) |
| **R87** | location-fallback eradikacija + Guest.locationId | `location-fallback.ts` IZBRISAN; hygiene val čez src (guests/feedback, opening-hours, time-entries, shifts, haccp, purchase-orders, z-report …); Guest.locationId migracija + backfill + wiring — guests PII scope (stolpec ALI order-tie), GDPR anonymizacija zaprta |
| **R88** | Per-location ordering token + delivery webhook envelope | HMAC token vezan na lokacijo OBVEZEN za online-order (deep link `/order?loc=&t=`); webhookEnvelopeToken za Wolt/Glovo/Bolt; `Integration.locationId` (migracija + backfill); odkrit in popravljen **integrations/[id] GET/PUT/DELETE cross-tenant IDOR**; QR meni generator ruta |
| **R89** | Token revokacija + izdajni UI | `Location.tokenVersion` (format `v1:<ver>:<hmac>`), POST rotate (atomic increment, admin-gated), OrderingLinkSection UI (kopiraj deep link, rotacija, QR meni download), webhook badge v tabeli |
| **R90** | Zadnji anonimni globalni READ fallbacki | public/menu + public/kiosk GET → unificiran 404 brez-orakelj (ZERO db); `resolveDefaultLocationId` izkoreninjen iz produkcije; integrations LIST/CREATE scoped (R88-2 sibling); WebhookUrlSection UI; meni/kiosk ostajata tokenless (scoping namesto token-gating — odločitev dokumentirana) |
| **R91** | `/api/qr-menu` P0-C3B residual izbrisan | E2E stale-pin audit odkril ŽIVO javno API ruto s starim cross-tenant fallbackom (missed R90 sibling) → izbris + allowlist očiščen + fs route-absent guard; rotate rate-limit; copy helper ekstrakcija; lekcija: **e2e pini ne smejo blagoslaviti vedenja brez preveritve v kodi** |
| **R92** | Rate-limit wave + 429 shape unifikacija | 11 admin write rut rate-limited (68/247 rut); NOV `rateLimitedResponse` kanon helper (Retry-After + X-RateLimit-Remaining/Reset); auth IP-429 dobi glave; health tagged `$queryRaw` → `$queryRawUnsafe`; e2e seed obnovljen na MODEL A shemo |
| **R93** | 429 kanon dokončan + e2e CI workflow | 11 admin rut + SMS + mobile 3/3 (brute-force model pred verifyApiKey); debug/query+env produkcija-gate analiza; tagged raw empirika (14-točkovna matrica — abort okoljski, ne tagged-lastnost); Playwright `e2e.yml` workflow |
| **R94** | Legacy 429 wave + e2e CI na realnem PostgreSQL | 55 datotek/66 mest → `rateLimitedResponse` (**429 kanon 100 % API površine**, 6 mest prvič glave); CI forenzika: pravi koren R92 abortov = multi-PGlite-instanca stomp; `e2e.yml` → postgres:16 service; seed EN VIR RESNICE (`e2e-seed-data.mjs` za PGlite + real-PG); 5 stale e2e pinov popravljenih z dokazi — **prvič full-suite e2e zelen 204/204** |
| **R95** | Dvostopenjska prijava + Table.status='reserved' lifecycle | Prijava **BINDING-WHEN-PRESENT**: `employeeId` podan = strog binding (enoten 401 zero-oracle), odsoten = legacy deterministični lastnik PIN-a; javen `GET /api/auth/employees` grid (rate-limited, unified 404, minimalen PII); Toast/Square UI izbira zaposlenega → PIN (aktiven na znani device lokaciji, fail-open na UX nikoli na varnost); `Table.status='reserved'` DB flip čez rezervacijski lifecycle — create v serializable tx / seated / cancelled / no_show s count-guardom / completed omejen na occupied / DELETE mirror (bookable filtri available\|\|reserved, server 409 avtoriteta); `GET /api/menu-items/[id]` pariteta; e2e login rate headroom (LOGIN_RATE_LIMIT_MAX 200) |
| **R96** | Deploy forenzika + admin binding naprave + e2e dvostopenjska | `/api/health` izpostavi **`commit`** (`VERCEL_GIT_COMMIT_SHA`) ob vseh response-rootih — 'ali je produkcija sinhronizirana?' je odgovorljiv z enim curl-om; verzija centralizirana (`getAppVersion`, legacy '1.0.13' fallback ubit z fs-guardom — health je poročal zastarelo verzijo od runde 84); **Settings → Naprava**: admin pogled/sprememba/brisanje bindinga lokacije naprave (persist/clear + toast, hydration-varno, R95 backlog UX); NOV e2e spec dvostopenjske prijave (A binding srečna pot / B fail-open z zaključeno prijavo / C byte-kompatibilnost — 3/3 lokalno pod privzetimi mejami; forenzika: middleware 'auth-login' vedro šteje tudi sejne GET /api/auth) |
| **R97** | WebAuthn/passkey device attestation fundacija + CI monitor + higiena | **Kriptografska plast bindinga** (localStorage je spoofable prek devtools — FIDO2 ni): model `WebAuthnCredential` (per-lokacija, MODEL A), stateless **signed challenge** (HMAC, TTL 120 s, fail-closed produkcija brez skrivnosti), javna `/api/auth/webauthn/options` + `/api/auth/webauthn/verify` (FIDO2 §6.1 counter strictly-greater = replay/clone reject, cross-location spoof guard), admin `/api/settings/webauthn/register` + `credentials` (GET/DELETE, scoped deleteMany, select nikoli publicKey); **Settings → Naprava → WebAuthn sekcija** (feature-detected, register/revoke z dvokliknim confirmom; login kontrakt NEDOTAKNJEN — R98 integracija); NOV **ci-monitor workflow** (CI/E2E failure → EN tracking issue, success → avtomatsko zapiranje); `.env.example` dokumentira LOGIN_RATE_LIMIT_MAX vedro (POST+GET, NAT, CI 200/30); cron header komentarji usklajeni z vercel.json (0 3 / 0 2); NOV e2e spec DeviceTab (A/B/C) |
| **R98** | Prisma query validacija + recovery forenzika | **Živi repro (browser QA)**: `GET /api/configuration/dining-options` je vrnil 400 INVALID_PARAMETER ob vsakem klicu — tabConfig je pošiljal OBOJE `select` IN `include` (Prisma 5: "Please either use include or select, but not both") → test kanon mehka točka: unit mocka db (validacija ne teče), e2e testira samo glavno /api/configuration, frontend tiho pade na prazen seznam (`?? []`) — pre-existing od R41, popravljen z merge-om relacij V select + regresijski test (6) pina "findMany args NIKOLI ne vsebujejo include"; sandbox recovery forenzika: klon s GitHuba (HEAD = R97 push, zero data-loss), dev PGlite rebuild, NEXTAUTH_SECRET pinLookup skladnost (seed-admin hard-coda sandbox secret), PGlite WASM abort po sovražnem dostopu dveh procesov = čist rebuild kanon |
| **R99** | WebAuthn prijava na vezani napravi + v14 challenge forenzika | **"Prijava s ključem naprave"** (PinLogin aditivna sekcija): na napravi z znano lokacijo + registriranimi ključi + podprtim WebAuthn → klik → fresh options → FIDO2 assertion → verify → **avtoritativna lokacija iz baze persistirana** (anti localStorage-spoof) + badge; fail-open na UX (notice role=alert, PIN nezadet); kill switch `WEBAUTHN_ENABLED` na options/verify (konsistenten z R79, produkcija-HTTPS noop); **v14 forenzika (e2e virtual authenticator)**: generate*Options STRING challenge = UTF-8 besedilo → ceremony challenge = base64url(utf8(token)) ≠ token → register/verify 400 — FIX: challenge podan KOT BAJTE (Uint8Array → fromBuffer = točen token) + bajtni kontrakt test (3); NOV e2e `pin-login-webauthn.spec.ts` (A register→logout→ceremony→badge→PIN prijava / B verify-401 intercept → notice → PIN unaffected / C brez ključev → gumb ni v DOM) — **prva živa FIDO2 ceremony pokritost registra + prijave**; +28 testov (3444/3444, 193) |

| **R100** | WebAuthn atomarni counter replay guard (TOCTOU fix) + lifecycle forenzika | **TOCTOU race v verify ruti zaprt**: R97 tok read(2) → verify(4) → update(6) brez pogoja = dva sočasna verify klica bi oba prebrala stari FIDO2 counter in replay-ani assertion sprejel tudi drugi (napadalec z ukradenim assertionom ima 120 s TTL okno za vzporedne poizvedbe) — FIX: write korak zdaj **atomaren check-and-set** (`updateMany` z `counter: { lt: newCounter }`), count 0 → unificiran 401; dva GENUINA assertion-a (dve ceremony, counters 5/6) ostajata uspešna; FIDO2 spec izjema 0→0 (authenticator brez counterja) gre prek navadnega `update` (samo `lastUsedAt`) — replay nosi 120 s TTL kot doslej; lifecycle testi: multi-key fan-out (2 ključa → excludeCredentials + allowCredentials, per-credentialId counter), mid-flight brisanje (admin izbriše ključ med ceremony → isti unificiran 401, zero pisnih operacij); +11 testov (3455/3455, 194) |

| **R101** | WebAuthn multi-origin expectedOrigin (produkcija-readiness) | **Origin-mismatch past zaprt**: `expectedOrigin` je bil enojni string iz `NEXTAUTH_URL` — dodatek custom domene / www / preview variante bi pomenil, da VSE FIDO2 ceremony (employee biometrični sloj R79 + device attestation sloj R97) padejo na origin mismatch; FIX: **`getWebAuthnOrigins()` allowlist** (NEXTAUTH_URL prioriteta, NEXT_PUBLIC_APP_URL, NOV `WEBAUTHN_EXTRA_ORIGINS` vejica-ločeno; validacija http/https, dedup, localhost fallback) in **vsi 4 verify wrapperji podajajo ARRAY** (v14: `string \| string[]`); cross-domain uporaba poverilnic ostane nemogoča (browser uveljavlja rpID kompatibilnost ob ceremony) — allowlist samo tolerira legitimate variante; dokumentirano v `.env.example`; +17 testov (3472/3472, 195) |
| **R102** | Rezervacije/čakalna vrsta: koncurenčni WRITE tokovi (TOCTOU razred iz R100) + error kontrakt | **5 najdenih lukenj zaprtih**: (F1) tx-notrani strukturirani throw-i create-handlerja (`{ error, status }`) so prišli do klienta kot **500 "[object Object]"** (niso Error instance → handleApiError fallback) — NOV `structuredErrorResponse` presliši 409/404/400/P2034 z pravim statusom (409 "drug uporabnik je rezerviral to mizo" je bil sestavljen in nato izgubljen!); (F2, HIGH) **PUT /api/reservations/[id] TOCTOU double-booking** — conflict check + update sta bila ločena (create je imel Serializable tx od FIX #3, PUT NE) → zdaj state machine + conflict + update + table flip-i ATOMARNO v `$transaction(Serializable)`, P2034 → 409; (F3, HIGH) **DELETE /api/reservations/[id] state machine bypass** — edini WRITE tok brez prehodne validacije (completed/no_show/cancelled → tiho "preklicani") → atomarni CAS `updateMany { status: { in: [confirmed, seated] } }`, count 0 → 400 terminal; CAS + count-guard + reset v tx (dva sočasna preklica = prej MRTVA reserved miza); (F4) **waitlist PUT check-then-act** → atomarni CAS `updateMany { id, status: existing.status }`, count 0 → 409 (R100 vzorec); (F5) waitlist DELETE → scoped `deleteMany` (P2025 → 404); +28 testov (3500/3500, 196) |

**Test napredek:** 2495 (R84) → 3242 (R94) → 3315 (R95) → 3347 (R96) → 3410 unit / 189 datotek (R97) → 3416 unit / 190 datotek (R98) → **3500 unit / 196 datotek (R102)** + 9/9 integracija + **210/210 E2E v CI**.

### 🔧 Popravki v v1.9.4 (QA runda 84 — reports tenant scope + wallet/outbox schema + guest-surface fail-closed)

| Kategorija | Popravek |
|------------|----------|
| 🚨 **R84-1: reports/* tenant scope — 6 HIGH (finančni agregati čez tenant-e)** | R84-0 read-only audit (2 agenta) dokazal 9/12 reports rut VULNERABLE. `sales`, `vat` (FURS-relevantna DDV razčlenitev), `popular`, `employees` (križno-tenant **PII**: imena/vloge/prihodki tujih zaposlenih + seznam zaposlenih), `ap-aging` (obveznosti dobaviteljem), `financial` (celoten P&L — vsi 10 poizvedb: groupBy/aggregate/findMany scoped, stockTransaction prek relacije `inventoryItem.locationId`) — vse prej BREZ locationId filtra za lokacijskega admina. Zdaj: `resolveTenantLocationIdOrThrow` + pogojni spread (super-admin = globalno, NIKOLI `{ locationId: null }`) |
| 🚨 **R84-1: eod POST — CROSS-TENANT WRITE** | Prej `findFirst({ status: 'open' })` BREZ lokacije → lokacijski admin je lahko **zaprl izmeno TUJE lokacije** z združenimi vsi-tenant povzetki. Zdaj: scope obvezen (pendingOrders count, activeShift findFirst, completedOrders, voidedItems vsi scoped) + **STROG location guard v transakciji** (`closeShiftTransaction`: legacy NULL izmena za loc-bound admina = SHIFT_NOT_FOUND; defense-in-depth proti race-u) |
| 🟠 **R84-1: eod GET residuals + digest platform gates** | `data-fetch.ts`: statusOrderWhere (statusCounts/cancelled/pending/voided) + stockCostGroups sedaj scoped (prej samo paidOrderWhere). `digest-preview/send/trend`: `platformAdminGate` (mirror receipts/rebuild) — prej je `permission:'admin'` prešel tudi lokacijske admine, ki so videli/sprožali globalne povzetke (globalni prejemniki + združeni prihodki VSEH lokacij) |
| 🚨 **R84-2: WalletPayment.locationId + OutboxEvent.locationId (schema rundi)** | Prej wallet scope **dvokoračen** (checkIds IN take-10000, PG bind limit) + outbox internal replay global-only. Zdaj: `WalletPayment.locationId` (Location? relacija SetNull + @@index), `OutboxEvent.locationId` (brez FK — event log decoupled). `getWalletPaymentStats`/route GET = **ENOKORAČNI scope**; `initiateWalletPayment` stampira iz `check.order.locationId` (data-derived, prioriteta) ali session/api-key; outbox internal processor poda `emitEvent(..., event.locationId)` — lokacijsko vezani webhook-i sedaj prejmejo internal evente. Migracija `_migrate-r84-location.mjs` (PGlite) + `backfill-wallet-outbox-location.ts` (census/DRY-RUN/--apply, idempotenten, chunked 10k, fail-closed — neizpeljivo ostane NULL) |
| 🚨 **R84-FIX2: wallet capture/refund — CROSS-TENANT MONEY MOVEMENT (H3 po final auditu)** | `POST /[id]/capture` + `POST /[id]/refund`: prej samo `manage_cash` permission → user tuje lokacije je lahko **bremil/povrnil tuje plačilo**. Zdaj: `resolveTenantLocationIdOrThrow` + scope v lib (capture: updateMany where.locationId + scoped re-read brez razkritja obstoja; refund: STROG guard v transakciji — legacy NULL = zavrnjeno) |
| 🟠 **R84-3: public/order tableNumber fail-closed (M2) + IoT binding + employees gate** | `resolveTable`: tableNumber BREZ locationId → **400** (prej globalni findFirst — prvi tenant z mizo št. N je dobil tuje naročilo + occupied write; tableId/QR pot nespremenjena). `iot/sensors` GET + `haccp` GET: role-aware `resolveTenantLocationIdOrThrow` (prej presence-based — ne-admin brez lokacije je videl globalno). `iot/readings`: neznana locationId → **400** (prej tiho NULL). `employees/[id]` PUT: super_admin izjema (pariteta s POST; prej 403 za platformnega admina) |
| 🧪 **+63 regresijskih testov** | `r84-reports-scope` (32: where-clavz pinanje vseh 12 rut + gate matrika + eod strict guard), `r84-wallet-outbox-location` (16: enokoračni scope, stamping derivacija, internal replay pass-through, upsert locationId), `r84-small-fixes` (15: IoT scope/atribucija, employees gate pariteta, wallet capture/refund matrika) — **2495/2495 unit (149 fajlov)** |
| 🧪 **Regresija — vse zelene** | lint **0/0** · tsc **0** · **2495/2495 unit** · **9/9 integracija** · 2 read-only final auditorja: fix-quality **PASS** (1 MEDIUM + 4 LOW → fix wave 2) + gap-hunt (**3 novi HIGH + 20 MEDIUM + 8 LOW → R85 backlog**, dokazano z file:line) |
| 📌 **Odpri točke (runda 85)** | **HIGH**: `GET /api/dashboard` (globalni P&L/analytics helperji), `delivery-tracking` (read + WRITE čez tenant-e — GPS/status/driver). **MEDIUM M1–M20**: kitchen + matrix, reservations, waitlist, time-off, staff-availability, labor-reports, inventory reorder/forecast/menu-stock/reorder-rules/food-cost, courses, ai/forecast, predictive-ordering, accounting/send-report-email, cis/submit-invoice, print, outbox GET/retry, NULL-stamp par (gift-cards POST, inventory POST), ScheduledEmailLog.locationId. **LOW L1–L8**: stock/check, distinct values, guests orders include, verify-chain details, debug/env mask, daily-checklist, ai-assistant snapshot. Dokazano v worklogu (R84-FINAL-2) |

### 🔧 Popravki v v1.9.3 (QA runda 83 — javne gost-rute + webhook-engine tenant binding + employees locationId stamp)

| Kategorija | Popravek |
|------------|----------|
| 🚨 **R83: employees POST locationId stamp (produkt prioriteta #1)** | Prej NIKOLI ni zapisal locationId → novi zaposleni (staff/manager/kitchen) z NULL lokacijo so na vseh R82 fail-closed gate-ih (EOD, bulk-vat, qr-batch, opening-hours) dobili **403 lockout** (session.locationId izhaja iz Employee.locationId). Zdaj: lokacijski admin → stamp seje (body.locationId ignoriran — cross-tenant write nemogoč); platform admin → izbirna validirana body.locationId ALI role=admin brez lokacije (platformni račun); staff/manager/kitchen brez lokacije → **400 fail-closed** (nič več razbitih računov). Bonus: super_admin izjema v admin-kreacija checku (R79 matrika) |
| 🚨 **R83: public/order-track — PRAZEN-TELEFON bypass (HIGH)** | `inputPhone.endsWith('')` je bil VEDNO true, ko naročilo ni imelo customerPhone → kateri koli 4-znakski telefon je "preveril" naročilo (cross-tenant branje statusa/postavk/zneskov po sekvenčnem per-lokacijskem orderNumber). Zdaj: naročilo brez telefona NI nikoli preverjeno (403 brez PII); telefon mora biti numeričen (`^\d{4,20}$`); izbirna `?locationId=` vezava; findMany(5) disambiguacija trkov čez lokacije; PII (ime, naslov) samo ob uspešni verifikaciji |
| 🚨 **R83: public/kiosk — globalni meni + artikli + idempotency replay** | GET: meni VSEH tenantov (`where: {isActive}`) → scoped na lokacijo kioska (`?locationId=` ali single-tenant fallback); POST: lokacija rešena **PRED** item fetchom + `category.menu.locationId` filter (tuji artikli/cene/DDV zaprti); idempotency replay scoped na lokacijo + tuj ključ → generičen 409 (globalni @unique namespace) |
| 🚨 **R83-FIX: webhooks POST global-by-default (HIGH po final auditu)** | Prej VSAK API-kreiran webhook brez locationId → lokacijski admin je lahko ustvaril webhook, ki je prejemal dogodke **VSEH tenantov** (order.paid zneski/tip, guest.created email, dostavni naslovi). Zdaj: lokacijski admin → webhook vezan na NJEGOVO lokacijo; platform admin → globalni (pooblaščen) ali validirana body.locationId; `webhooks GET` → tenant scope |
| 🚨 **R83: webhook-engine trigger — komentar ≠ koda** | `triggerWebhook` brez locationId je izpolnjeval `{ isActive: true }` = **vsi webhook-i vseh tenantov** (komentar je trdil "samo globalni"). Zdaj: `{ isActive: true, locationId: null }` = samo globalni; z locationId → lokacijski + globalni (OR). `emitStockLow`/`emitReceiptCreated`/`emitReceiptFiscalVerified` + **16 emit klicnih mest** (payments, cash-register, shifts, guests, order-actions, put-handler, reservations, delivery-tracking, FURS post-verify, stock broadcast, POS order path, wolt/glovo/bolt) dobi locationId pass-through |
| 🟠 **R83: wallet-payment scope + public/order + order-config + delivery-check** | `wallet-payment` GET/stats: prej globalni agregati tudi za lokacijske uporabnike → dvokoračen scope prek checkIds (model NIMA relacije; take 10000 = PG bind guard); POST: checkId ownership (404 tuj ček — prej RAW zapis). `public/order`: `isRestaurantOpen(locationId)` — prej MEŠANI urniki vseh tenantov; tableNumber lokacijska disambiguacija; miza se označi 'occupied' ŠELE po gate-ih (phantom-occupied fix). `order-config` + `delivery-check`: ciljna lokacija (`?locationId=`/`?locationCode=`, sicer prva aktivna) — prej globalne cone + mešani urniki |
| 🟠 **R83: setup/init rate limit + NULL-location atribucija** | `setup/init`: `SETUP_LIMIT` 5/15min (prej anonimen bcrypt cost 12 = CPU DoS + first-caller-wins race); `iot/readings` + `iot/sensors` + `feedback-public`: locationId atribucija (prej NULL-location HACCP/GuestFeedback vnosi — nevidni v scoped poročilih) |
| 🧪 **+33 regresijskih testov** | `r83-guest-routes` (33): employees stamp matrika (5), order-track bypass+PII+scope (6), kiosk scope (4), webhook trigger where (2), wallet scope+ownership (5), isRestaurantOpen fail-closed (3), resolveTable disambiguacija (2), feedback stamp (2), webhooks stamp+scope (4) — **2432/2432 unit (146 fajlov)** |
| 🧪 **Regresija — vse zelene** | lint **0/0** · tsc **0** · **2432/2432 unit** · **9/9 integracija** · 2 read-only final auditorja: **PASS** (0 blokatorjev; 3 MEDIUM + 5 LOW → R84 backlog) |
| 📌 **Odpri točke (runda 84)** | **Schema rundi**: `WalletPayment.locationId` (ubije dvokoračen scope), `OutboxEvent.locationId` (internal eventi), `Guest/Integration.locationId` (R82 ded). **MEDIUM**: tableNumber brez locationId = globalni fallback (dokumentirano; UI naj pošilja tableId ali locationId). **LOW**: IoT key→location per-senzor mapiranje, kiosk POST `?locationId`, employees [id] PATCH super_admin izjema, reports/* agregati (8×), PROD census → backfill odločitev |

### 🔧 Popravki v v1.9.2 (QA runda 82 — security/data closure: platform gates + guest flusi + QR-pay lifecycle + maintenance sweep)

| Kategorija | Popravek |
|------------|----------|
| 🚨 **R82-A/B: platform-admin gate ×2 (potrjeni R81 leftover)** | `GET/POST/PATCH /api/subscription/invoices` — lokacijski admin je videl račune VSEH tenantov, generiral račune za katero koli naročnino in s status=paid **AKTIVIRAL naročnino** (trial → active = samopodaljšanje SaaS dostopa); `POST /api/receipts/rebuild` — globalna maintenance operacija za vsakga admina. Zdaj: platform-admin gate (admin/super_admin BREZ lokacije, mirror R81 kanon); gate PRED vsakim db klicem (DB reads = 0 pri blokadi) |
| 🚨 **R82-C: API-key tenant binding — guest flusi (audit-dokazano)** | Audit verifyApiKey() dokazal: `subscriptionId` (P0-C5) je bil **nikoli porabljen**. `POST /api/mobile/order` (**HIGH**): bare `table.findUnique` → ApiKey tenanta A + tableId mize tenanta B = naročilo na tuji lokaciji, poraba tujega per-lokacijskega counterja, KDS broadcast tuji lokaciji; tuja miza → 404 (NE tiho fallback); lokacija rešena PRED item validacijo; menuItems scoped (`category.menu.locationId`); idempotency replay scoped + P2002 s tujim ključem → generičen 409. `GET /api/mobile/order`: order.findFirst scoped na `location.subscriptionId` + fail-closed 403 brez naročnine. `POST /api/public/online-order` (**MEDIUM**, R81-E2 potrjeno nefiksano — zadnja sprememba runda 39): lokacija rešena PRED meni poizvedbo, items scoped (cross-tenant injection + existence oracle zaprt), INSUFFICIENT_STOCK brez točnih količin (stock oracle do decimale zaprt). `/api/security-audit`: izdajateljeva naročnina (session.locationId → location.subscriptionId) za list/create/revoke/delete/rotate — prej createApiKey = PRVA naročnina v DB, list brez filtra čez vse tenante. Rate limit `PUBLIC_ORDER_LIMIT` na obe mobile/order poti (prej BREZ) |
| 🚨 **R82-D: QR-pay token lifecycle + PRODUCTION SECRET** | Token **v2** = `v2:<issuedAtMs>:<hmac>` — stateless **TTL 15 min** + future-skew guard 5 min; legacy 64-hex tokeni (brez TTL) zavrnjeni; USED = plačan ček zavrača (enkratna uporaba); REVOKED = re-issue nov token (stateless kompromis dokumentiran). **Hard-code dev secret ODSTRANJEN** — produkcija brez QR_PAY_SECRET/ENCRYPTION_KEY/NEXTAUTH_SECRET → init 503 + helper fail-closed (prej: javno znan dev secret = kovanje tokenov za tuje čeke) |
| 🚨 **R82-F: maintenance endpoints sweep — 5 novih HIGH zaprtih** | Read-only sweep 216 auth-gated datotek (dvoprehodno pravilo) → fix wave: `end-of-day` (EOD agregati globalni + raw body.locationId = zapiranje **TUJE izmene**; zdaj scope + body strip), `menu-items/bulk-vat` (updateMany **GLOBALNO** = DDV sprememba čez vse tenante → scoped), `tables/qr-batch` (QR URL-ji vseh miz vseh tenantov → scoped), `opening-hours` (raw body.locationId = deleteMany+recreate tuje lokacije; `[id]` bare update/delete → isWithinScope 404), `reports/export` (CSV/PDF/Excel/XML izvoz **PII vseh tenantov** → scope skozi 6 generatorjev + fetchReportData) |
| 🚨 **R82-F: 2 platform gates + 2 cron FAIL-OPEN buga** | `receipts/regenerate` + `accounting/journal/regenerate` (globalna backfill operacije → platformAdminGate, mirror rebuild); `cron/data-retention` + `cron/outbox` — guard `if (expectedAuth && ...)` je bil **brez CRON_SECRET POPOLNOMA PRESKOČEN** → anonimni GDPR deleteMany / SMS batchi! Zdaj fail-closed; `webhooks/deliveries` GET scoped prek webhook.locationId + POST global retry → platform gate |
| 🧪 **+83 regresijskih testov** | `r82-platform-gates` (15), `r82-api-key-guest-flows` (24), `r82-qr-pay-lifecycle` (17), `r82-maintenance-sweep` (26), r81-qr-pay posodobljen na v2 (8) — vključno z ulovljenim **realnim bugom** (subId ReferenceError v P2002 catch bloku) — **2399/2399 unit (145 fajlov)** |
| 🧪 **Regresija — vse zelene** | lint **0/0** · tsc **0** · **2399/2399 unit** (145 datotek) · **9/9 integracija** · 2 read-only final auditorja: vsi 3 commiti PASS, 0 blokatorjev |
| 📌 **Odpri točke (runda 83)** | **Produkt prioriteta**: employees POST locationId stamp (nove NULL-location zaposlene blokirajo novi fail-closed gate-i). **Javne guest rute (sveže-oke audit)**: public/order-track (prazen-telefon bypass + global orderNumber lookup), public/kiosk (global meni + items brez scope), public/order (tableNumber globalna disambiguacija), webhook-engine trigger (komentar "samo globalni" ≠ koda — vsi webhook-i prejmejo dogodke vseh tenantov), wallet-payment stats, order-config/delivery-check, setup/init rate limit, IoT locationId atribucija. **MEDIUM/LOW**: 8× reports/* agregati, z-report F-pripombe, PROD census (`DATABASE_URL=<neon> bun scripts/audit-location.ts`) → backfill odločitev |

### 🔧 Popravki v v1.9.1 (QA runda 81 — AuditLog tenant model + finalni read/write sweep)

| Kategorija | Popravek |
|------------|----------|
| 🏗️ **AuditLog.locationId — pravi tenant model** | AuditLog dobil `locationId String?` + index (shematska sprememba, migracija). Centralna helperja `createAuditLog`/`createAuditLogsBatch` zdaj SAMODEJNO izpeljeta lokacijo (userId → Employee.locationId, best-effort — derivacija nikoli ne podre zapisa, PCI DSS); 5 direktnih `auditLog.create` mest (payments ×2, qr-pay, gdpr ×3) eksplicitno označena z entitetno izpeljavo (Payment nima lastnega stolpca → check.order.locationId). **locationId je NAMERNO izklopljen iz hash verige** — chainHash ostane backward-kompatibilen, backfill ne lomi tamper-evidence. `GET /api/audit` + `GET /api/notifications` zdaj tenant-scoped (fail-closed); backfill + census scripta: `scripts/audit-location.ts` (census/dry-run/`--apply`, dokazan na sintetičnih podatkih: via user + via entity + sistemski NULL) |
| 🔍 **Finalni read/write sweep (2 read-only agenta, 81 fajlov)** | razred haccp/gift-cards napak (findUnique brez scope pred mutacijo): **13 novih HIGH** odkritih in vseh popravljenih; 11 MEDIUM (8 popravljenih, 2 dokumentiranih za R82, 1 LO); 41+40 fajlov klasificiranih — 41 SAFE re-verificiranih |
| 🚨 **HIGH: webauthn/register — cross-tenant account takeover** | `isAdmin` pot ni preverila lokacije ciljnega zaposlenega → location-bound admin je registriral SVOJ avtenticator na tujega zaposlenega → prijava v tuj tenant. Zdaj: owner-location matrika (kot credentials/[id] iz R79) + super_admin v vlogskem checku, preverjanje PRED porabo challenge-a |
| 🚨 **HIGH: qr-pay — javna plačilna pot prekinjena po zasnovi** | sessionToken je bil random hex, ki se NI nikjer shranil in se NIKOLI preveril: `GET /api/qr-pay` je vrnil PRVI neporavnan ček GLOBALNO; `confirm` je dovolil plačilo katerega koli čeka po ID-ju. Zdaj: **stateless HMAC vezava** (`token = HMAC-SHA256(secret, checkId)`, timing-safe verify — `src/lib/qr-pay-token.ts`): GET vrne SAMO ček, čigar HMAC ujema token; confirm zahteva veljaven token za checkId (403); init lokacijsko scoped (order.locationId); rate limit 10/min na obe javni poti |
| 🚨 **HIGH: 5× write-through-tenant** | `delivery-zones/[id]` (PATCH+DELETE + locationId reassign), `inventory/adjust` + `inventory/restock` (cross-tenant zaloge), `kot` (KOT za tuj naročilo + unscoped seznam), `gdpr/anonymize` (uničenje tujega PII), `happy-hour` (+[id], tuj priceGroup), `tip-pool` PUT (cross-tenant distribucija), `receipts/[id]` POST (fiskalizacija tujega naročila), `purchase-orders/[id]` receive (cross-tenant zaloge + AP), `packaging/[id]` (3× bare findUnique) — vsi fail-closed (findFirst + isWithinScope/notInScopeResponse 404) |
| 🟠 **MEDIUM/LOW + produktni gates** | `card-terminal` (plačilo na tujem terminalu), `gdpr/export` (admin samo ista lokacija/super-admin), `guests/[id]` (orders include scoped; Guest.locationId = R82), `reservations/[id]` (tableId validacija + 409 brez tujega imena), `staff-shifts` POST, `time-entries` POST, `suppliers/[id]/scorecard`, `virtual-brands`, `cash-register/[id]` (NULL-location izmena → fail-closed 404), `setup/status` (točne številke skrite po initu), `subscription` + `admin/migrate` (**platformni-admin gate**: role admin/super_admin BREZ lokacije), `notifications` stats scoped |
| 🧪 **+71 regresijskih testov** | `r81-audit-tenant-model` (11), `r81-scope-hardening` (16), `r81-final-sweep` (15), `r81-final-sweep-2` (22), `r81-qr-pay-token` (7) — derivacija, fail-closed matrike, HMAC vezava, super-admin global, PII strip — **2316/2316 unit** |
| 🧪 **Regresija — vse zelene** | lint **0/0** · tsc **0** · **2316/2316 unit** · **9/9 integracija** |
| 📌 **Odpri točke (runda 82)** | `Guest.locationId` + `Integration.locationId` stolpca (schema runda); qr-pay shranjene seje z TTL (HMAC vezava je trajna — token samo na QR sliki čeka); `mobile/order` + `public/online-order` gost-flusi (api-key scope, locationId iz telesa); `subscription/invoices` platform gate; legacy NULL-location census na PROD podatkih → backfill odločitev; `receipts/rebuild` admin maintenance op |

### 🔧 Popravki v v1.9.0 (QA runda 80 — agregacijski endpointi + unifikacija tenant modulov)

| Kategorija | Popravek |
|------------|----------|
| 🧩 **Unifikacija tenant modulov (EDINI vir resnice)** | Do zdaj 2 modula s podvojenim pravilnikom: `lib/tenant-scope.ts` (MODEL A katalog) + `auth-middleware/tenant-scope.ts` (transakcijski resolver) — vsak s svojim admin role setom in fail-closed sporočilom. Zdaj EN modul `lib/tenant-scope.ts`: skupni `TENANT_ADMIN_ROLES` + `isAdminTenantRole` + `NO_LOCATION_MESSAGE`, oba resolverja (`resolveTenantLocationId` + `resolveCatalogScope`) delita isto vlogsko matriko; stara pot ostane kot deprecated re-export shim (barrel `@/lib/auth-middleware` nespremenjen); `tenantScopeToWhere` zdaj sprejme tudi OrThrow rezultat |
| 🔍 **Sistemski pregled agregacijskih endpointov** | 64 route fajlov z `groupBy`/`aggregate`/`count`/`$queryRaw` auditrani z 2 vzporednima read-only agentoma: 73 konstruktov → 39 SAFE, 20 LEAK (10 HIGH, 9 MEDIUM), 14 NEEDS-REVIEW; **0 injection težav** (vsak raw SQL parameteriziran/whitelist) |
| 🚨 **HIGH: AI NL-query — celotna ruta čez tenantе** | `POST /api/ai/nl-query` (view_reports): vseh 9 query vej (revenue, top items, peak hours, cancellations, tips, employee perf) BREZ locationId → promet/DDV/napilci/imena zaposlenih VSEH tenantov. Zdaj: resolveTenantLocationIdOrThrow + scope v vsakem where (relacijske poti OrderItem→order, MenuItem→category.menu, Employee.lastna lokacija) |
| 🚨 **HIGH: 2 write IDOR + 2 fail-open branja** | `POST /api/tables/transfer` — findUnique brez scope-a → prenos naročil med tujimi lokacijami (mirrors P0-C1: findFirst + 404); `PUT/DELETE /api/gift-cards/[id]` — parent brez isWithinScope → manipulacija stanja tujih kartic (404); `GET /api/checks` — raw session ?? undefined fail-open → fail-closed resolver; `GET /api/inventory/transactions` — count+groupBy(_sum totalCost)+POST lookup scope-ani |
| 🚨 **HIGH: finančni agregati čez tenantе** | `reports/shifts` (aggregate _sum sales/tips), `operational-alerts` (vseh 9 query), `purchase-orders`, `time-entries` (payroll payRate/totalPay) — vsi dobili fail-closed scope (super-admin global ostaja) |
| 🟠 **MEDIUM: FURS/CIS + gostje + HACCP + lokacije** | `furs` (unfiskalizirani count), `furs/cert-status` (2× ZDDV-1 count), `furs/batch` GET (POST več-lokacijski po zasnovi — nedotaknjen), `cis/echo` (retry findMany NE pošilja več tujih računov v CIS), `guests/feedback` (PII: 7 query + fail-closed 403), `haccp` (food-safety zapisi), `locations` (location-bound vidi samo svojo), `locations/[id]` (guard pred order.aggregate dnevne promete — isti razred kot runda 76 locations/sync) |
| 🟠 **notifications: staff → admin + PII strip** | AuditLog nima tenant stolpca (schema fix = runda 81), zato: GET permission `take_orders` → `admin` + `stripRecipientPii()` odstrani `details.recipient` (telefon/email) iz odgovora |
| 🧪 **+61 regresijskih testov** | `tests/unit/security/r80-aggregate-scope-*.test.ts` (A: 35, B: 13, C: 13): fail-closed 403 matrika, per-where scope wiring (relacijske poti), `?locationId` bypass ignoriran, super-admin global (filter OMETAN — nikoli `{ locationId: null }`), 404 brez razkritja obstoja — **2245/2245 unit (136 datotek)** |
| 🧪 **Regresija — vse zelene** | lint **0/0** · tsc **0** · **2245/2245 unit** (136 datotek) · **9/9 integracija** |
| 📌 **Odpri točke (runda 81)** | `AuditLog.locationId` stolpec + backfill (pravi fix za notifications); `haccp` PUT/DELETE by-ID scope guard; legacy NULL-location vrstice (Shift/GiftCard/InventoryItem — backfill ali produkt odločitev); monitoring/metrics + setup/status + subscription — produkt odločitve (global-by-design vs per-tenant) |

### 🔧 Popravki v v1.8.11 (QA runda 79 — tenant scope: webauthn credentials + MODEL A fail-closed)

| Kategorija | Popravek |
|------------|----------|
| 🚨 **KRITIČNO: webauthn credentials GET — cross-tenant enumeracija** | `GET /api/auth/webauthn/credentials?employeeId=` je za vsakga "admina" (role admin ALI manage_employees dovoljenje) vrnil poverilnice KATEREGA KOLI zaposlenega BREZ lokacijskega preverjanja → location-bound upravljavec je lahko enumeriral biometrične poverilnice (device fingerprinti, nicknames) vseh tenantov. Zdaj: super-admin (role admin + locationId=null) globalni; location-bound → samo zaposleni svoje lokacije; upravljavec brez lokacije → fail-closed 403 |
| 🚨 **KRITIČNO: webauthn credentials DELETE — fail-open** | Pogoj `if (isAdmin && session.locationId)` je upravljavcu z manage_employees dovoljenjem BREZ session.locationId (Employee.locationId je nullable) CELOTEN owner-location check preskočil → lahko je BRISAL poverilnice vseh tenantov. Poleg tega role check ni poznal 'super_admin'. Zdaj: enaka matrika kot GET (fail-closed 403, super-admin izjema) |
| 🟠 **MODEL A katalog — fail-closed scope resolucija** | `sessionLocationId(authResult)` je vrnil null za uporabnika brez lokacije → `locationFilter(null)` = {} = VIDI KATALOG VSEH TENANTOV (menus, categories, menu-items, modifier-groups, discounts, packaging, tables write, configuration — 29 klicnih mest v 15 fajlih). Nov centralni role-aware `resolveCatalogScope` v `lib/tenant-scope.ts`: admin brez lokacije = super-admin nadzor, ne-admin brez lokacije = fail-closed 403; VSA klicna mesta migrirana (dva vzporedna agenta, 16 + 13 mest), `sessionLocationId` v API plastí popolnoma umaknjen |
| 🧪 **+14 testov** | `tests/unit/security/webauthn-credentials-tenant.test.ts`: DELETE (8 scenarijev — upravljavec isto/tujjo lokacijo, fail-closed brez lokacije, super-admin global, role admin lokacijski, lastna/tujja poverilnica navadnega uporabnika, 404) + GET (6 scenarijev — ista/tujja lokacija, fail-closed, super-admin, lasten seznam, 403 tuj ID) — **2184/2184 unit (128 datotek)** |
| 🧪 **Regresija — vse zelene** | lint **0/0** · tsc **0** · **2184/2184 unit** (128 datotek) · **9/9 integracija** |

### 🔧 Popravki v v1.8.10 (QA runda 78 — brskalniška QA end-to-end: 2 popravka)

| Kategorija | Popravek |
|------------|----------|
| 🐛 **Samodejni tisk kuhinjskega naročila NIKOLI deloval** | `autoPrintKitchenOrder` (orders post-handler) je pošiljal INTERNI HTTP fetch na `/api/print` BREZ `Authorization` glave → 401 na VSAKO naročilo, tiho poginilo v catch (isti razred napake kot WS broadcast — WS AUDIT 2026-09-09 — ta klicatelj je bil izpuščen). Zdaj: direkten in-process klic `handleOrderPrint()` — brez HTTP hopa, brez auth potrebe (klicatelj je že avtenticiran). Verificirano v brskalniški QA: 0× `POST /api/print 401` po fixu |
| 🐛 **BiometricLogin: render side-effect** | `checkAvailability()` je bil klican MED renderjem (`if (isAvailable === null) { void checkAvailability(); return null }`) → ko se je komponenta unmountala pred resolvm (Fast Refresh, navigacija, WebAuthn 503), je `setIsAvailable` zadela unmounted komponento → React warning "state update on a component that hasn't mounted" ob vsaki prijavi. Zdaj: `useEffect` z `cancelled` guard. Verificirano: 0 napak v konzoli na login strani |
| 🧪 **Brskalniška QA (agent-browser, end-to-end)** | Potrjen zlati tok: setup/init first-run → PIN prijava (tipkovnica + numpad) → POS meni/kategorije → košarica → oddaja naročila (DDV matematika: 3,50 € + 22 % = 4,27 €) → plačilni modal (metode, hitra gotovina, zvestoba skip) → predogled računa → tisk 200 → digest (SKUPNI PROMET, TRENDI 7/30, METODE PLAČILA, **PROMET PO URAH** ★ vrh 19. ura) — vse zelene |
| 🧰 **Dev okolje** | `.gitignore`: `.pglite-qa/`, `qa-*.png` (QA artefakti); package.json verzija usklajena z README (v runda 77) |
| 🧪 **Regresija — vse zelene** | lint **0/0** · tsc **0** · **2170/2170 unit** (127 datotek) · **9/9 integracija** |

### ✨ Nove funkcije v v1.8.9 (QA runda 77 — urna razporeditev v email digestu + waiter offline)

| Kategorija | Funkcija |
|------------|----------|
| 📧 **Digest email: "Promet po urah"** | Email digest (cron ob 2:00 UTC + predogled) zdaj vsebuje **24-urno razporeditev prometa** — email-safe različica R76 UI sekcije, dokončana povezava podatkovnega toka R76 (podatki so tekli v builder, HTML jih je izrecno ignoriral). Email-safe omejitve upoštevane: samo tabele + inline stili (Gmail odstrani `<style>`, Outlook Word engine brez flex/% višin) — stolpci so div-i s fiksnimi px višinami znotraj td-jev (`vertical-align: bottom` = skupna bazna črta prek border-bottom), vrh **amber**, redne ure **teal**, oznake vsaka 3. ura (`showLabel` iz R76), legenda z zasedenostjo, `title` nasveti per stolpec. Čipi v istem formatu kot UI: "★ vrh: 8. ura (61,65 €)" + "▦ najboljše okno 06–09 h (150,00 €)". Sekcija se graciozno izpusti, ko `hourly` manjka ali je brez prometa (vzorec R65 — brez praznih obljub) |
| 📶 **NetworkStatusBar na waiter** | Natakarjeva tablica (/waiter) zdaj vidi **nivo naprave** (navigator.onLine + števec čakajočih offline naročil iz IndexedDB vrste) — obstoječi WS čip v glavi pokriva SAMO Live povezavo, ne ugašenega wifi-ja. Online + nič čakajočih → diskreten trak (ne zasede prostora); offline → izrazit rdeč trak "BREZ POVEZAVE". PWA polish iz R76 kandidatov |
| 🧪 **+6 testov** | daily-digest HTML: sekcija prisotna (čipi, 24 stolpcev, legenda), bar višine (100 %→80px, 50 %→40px), vrh amber/teal barve, ura brez prometa → brez diva (bazna črta ostane), oznake 9/24 (vsaka 3. + vrh), star klicatelj brez `hourly` → izpuščena, vsi-nič → izpuščena — **2170/2170 unit (127 datotek)** |

### 🔧 Popravki v v1.8.9 (QA runda 77 — tenant scope zaključek: 5 popravkov)

| Kategorija | Popravek |
|------------|----------|
| 🚨 **KRITIČNO: e-invoice-book tenant override** | Super-admin `?locationId` override je veljal SAMO za storno query (izdani so ostali na session.locationId) → isti poročili sta lahko mešali DVA tenant-a; hkrati `session.locationId=null` → fail-open pogled računov VSEH tenantov. Zdaj centralni `resolveTenantLocationIdOrThrow`: enoten scope za izdane + storno + izdajatelja, fail-closed 403 za uporabnika brez lokacije, super-admin override konzistentno za OBE query |
| 🚨 **KRITIČNO: locations/sync tenant scope** | Vsak admin je lahko sinhroniziral meni iz KATERE KOLI izvorne lokacije na KATERE KOLI ciljne (cross-tenant overwrite tujega menija + branje izvora); GET je poleg tega puščal dnevne/mesečne prihodke VSEH lokacij (order.groupBy BREZ locationId filtra). Zdaj: lokacijsko vezana seja sme samo source=own + targets⊆{own} (cross-location = 403, rezervirano za super-admina); GET seznam lokacij + groupBy poročila po lokaciji |
| 🟠 **FURS fail-closed: neveljavna lokacija** | `getFursConfig('ne-obstaja')` je tiho padel na globalni RestaurantSettings/env cert → podpis računa s TUJIM certifikatom (cross-tenant key use, napačen premisesId, davčna kršitev). Zdaj: ekspliciten locationId brez Location → 503 BREZ fallbacka (lokacija, ki obstaja a ni konfigurirana, še vedno pade na legacy fallback — issue #37 compat); `getRestaurantInfoForLocation` enako — prazna identiteta (`source='not-found'`) namesto tuje davčne št. na fiskalnem dokumentu |
| 🟠 **`/api/setup/db` error reporting** | Vse DDL napake so bile tiho požrte (`catch {}`) — operater ni videl, KATERI stavki so padli in zakaj (permission denied, sintaksna napaka …). Zdaj odgovor vsebuje `failedStatements` (prvih 25: stavek + napaka), `schemaStatementsApplied`, `alterStatementsFailed`, `failedStatementsCount` — diagnostika namesto tihega "success: true" |
| 🟠 **Centralizacija tenant resolverja** | 5 rut z ročnim `if (session?.locationId)` fail-open pogojem (GET tables, inventory, employees, gift-cards, loyalty — null locationId = globalni pogled za kdor koli) migriranih na `resolveTenantLocationIdOrThrow` (fail-closed 403 brez lokacije; super-admin globalni pogled ohranjen); e-invoice-book + locations/sync prav tako na centralnem vzorcu — **28 API datotek zdaj na resolverju (prej 22)** |
| 🧪 **Regresija — vse zelene** | lint **0/0** · tsc **0** · **2144/2144 unit** (126 datotek) · **9/9 integracija** |

### ✨ Nove funkcije v v1.8.8 (QA runda 76 — Promet po urah + deploy-recovery R75)

| Kategorija | Funkcija |
|------------|----------|
| 📊 **Digest "Promet po urah"** | Dnevni digest (/reports/digest) zdaj prikazuje **24-urno razporeditev plačanih naročil** — CSS-only urni graf v istem vizualnem jeziku kot Trendi sparkline (R71/72): 24 stolpcev (vedno polna širina — stabilna postavitev), vrh urnika z amber gradientom + ★ vrednostjo nad stolpcem, oznake vsaka 3. ura (\u00A0 placeholder — brez layout shift-a), legenda, title nasveti, aria-labeli per stolpec, print-varen (break-inside-avoid + print: variante). Sekcija se skrije, ko dan nima prometa — optional polje (vzorec R65) | 
| 🧠 **`lib/digest-hours.ts`: urni vzorec** | Čista biblioteka (vzorec digest-trend R71–R73): `computeHourlyDistribution` — 24 polnih vedrov po **lokalni uri** (konsistentno z dayBounds), fail-safe totali (Decimal/string/null/NaN/negativno → 0), neveljavni datumi preskočeni (date-only nizi zavrnjeni — R72 lekcija sistemsko), vrh izenačen → najzgodnejša ura, brez prometa → brez vrha; `summarizeHourly` — vrh, zasedenost (št. ur s prometom) in **najboljše zvezno 3-urno okno** (izenačena → najzgodnejše) |
| ▦ **Najboljše okno psevdo-pasica** | Stilna plast: obarvana psevdo-pasica (amber tint + ring-inset) za stolpci na območju najboljšega zveznega 3-urnega okna — menedžer takrat vidi, KDOD prihajajo gostje, ne samo katera ura je bila najvišja. Čipi: "★ vrh: 8. ura (62 €)", "promet v N urah", "▦ najboljše okno 06–09 h" |
| 🔌 **5. vzporedna poizvedba** | `fetchDailyDigestData` dodaja `db.order.findMany({ total, createdAt })` (minimal select — ~50–200 naročil/dan, JS vedrčenje v lib) v obstoječo `Promise.all` skupino — brez dodatnega latency-ja; `DailyDigestData.hourly?` optional polje (stari klicatelji/testni fixture-i ostanejo veljavni) |
| 🛡️ **Deploy-recovery R75** | R75 varnostni popravki (tenant scope blagajna/mize — 996f58e0→df80e31a) NIKOLI niso dosegli produkcije (webhook miss); prazen commit re-trigger (6ded2d1c) vzpostavil R75 na produkciji; nadaljnji webhook miss za R76 rešen z **direktnim API deploymentom** (`POST /v13/deployments` + gitSource) — nov zanesljiv vzorec ob podaljšanim webhook izpadom |
| 🧪 **+20 testov** | digest-hours: vedrčenje (lokalne ure, 24 polnih vedrov), fail-safe (Decimal-string, null/NaN/negativno → 0 + naročilo vseeno šteje, neveljavni datumi preskočeni), vrh (izenačeni → najzgodnejši, brez prometa → brez vrha), višine (min 2 %), oznake (vsaka 3. + vrh, brez podvajanja), okno (izenačena → najzgodnejše, 21–23 konec dneva, brez preloma 23→0); daily-digest: query oblika + kontrolna vsota — **2164/2164 unit (127 datotek)** |

### 🔧 Popravki v v1.8.7 (QA runda 75 — globinski bug-hunt: 19 popravkov)

| Kategorija | Popravek |
|------------|----------|
| 🚨 **KRITIČNO: `/api/setup/db` auth bypass** | `startsWith('/api/setup')` izjema v auth-middleware je pustila DDL endpoint (CREATE TABLE + ~90 ALTER TABLE) javno dostopnega → ANONIMNA DDL na produkcijski bazi. Izjema zdaj ekspliciten seznam first-run endpointov (init/status/super-admin) + `isAuthorized()` zahteva DEJANSKO sejo |
| 🚨 **KRITIČNO: ZOI po ZDDV-1** | ZOI = Base64(**MD5**(RSA-SHA256 podpis)) — prej SHA-256 + subarray(0,16) → FURS verifier bi zavrnil vsak račun. Enak algoritem kot HR ZKI (zlati vektor: isti podpis, različen ZOI) |
| 🚨 **KRITIČNO: dvojno povračilo plačil** | `/refund` zdaj zahteva status `completed` (prej status bran, a nikoli preverjen); PUT reversal zapiše `refundAmount` in reverzira SAMO nepovrnjeni del — prej: PUT void + POST refund = DVOJNI gift-card/loyalty kredit |
| 🔒 **Čeki — tenant scope** | GET/POST/discount-lookup zdaj po lokaciji (isti P0-C1 razred kot payments fix 2026-09-09); `linkOrderItemsToCheck` z `orderId` filter — prej je updateMany premaknil KATERE KOLI item-ID-je (cross-order/cross-tenant item hijack, plačani čeki s podtekanimi totali) |
| 🔒 **Blagajna — tenant scope** | PUT zapre izmeno samo svoje lokacije (prej katera koli po ID-ju); POST odpira izmeno na SESSION lokaciji (prej po klientovem employeeId → poljubna lokacija; `CROSS_LOCATION_SHIFT` → 403) |
| 🔒 **Združevanje miz** | lokacijski scope na mizah + prepoved združevanja DELNO PLAČANIH naročil (plačila bi ostala vešča na preklicanem naročilu); recalc ohrani popust in tip ciljnega naročila (prej izgubljena) |
| 🔒 **WebAuthn `locationId`** | biometrična seja je dobila `locationId: null` = GLOBALNI tenant dostop namesto lokacije zaposlenega — zdaj kot PIN prijava |
| 💰 **Void zaščite (order-items)** | prepoved voida na plačanem/delno plačanem čeku (FURS: to je storno); pogojni claim `updateMany` (dva vzporedna voida = prej dvojno vračilo zaloge); vračilo zaloge samo, če `order.inventoryDeducted` (prej slepo napihnilo zalogo) |
| 🧾 **Z-poročilo + EOD — storno & neto** | storno naročila zdaj vključena (totalStorno je bil STRUKTURNO vedno 0 — mrtav filter); neto zneski (amount − refundAmount) pri prodaji po načinih plačila in expectedCash — brez lažnega denarnega primanjkljaja ob zaključku dneva; order status po refundu agregira VSE čeke (split-check fix) |
| 🇸🇮 **FURS multi-lokacija** | certifikatni cache KLJUČAN po `certPath` (prej 1 globalni slot 1 h → lokacija B podpisovala s ključem lokacije A); ZOI ključ iz per-lokacijskega configa + `ensureDecrypted` (prej globalni settings ključ ≠ JWS ključ); JWS serial brez izgube preciznosti (Number() poči > 2^53 — FURS Java long); DST prehod CEST→CET ob 01:00 UTC (ura off-by-one v 60-min oknu 1×/leto) |
| 🛡️ **CSP nonce — dejansko delujoč** | nonce zdaj propagiran na REQUEST headerje (`NextResponse.next({ request: { headers } })`) — Next.js injektira nonce v inline skripte LE iz request CSP; prej response-only → nonce nikoli ni zaščitil ničesar, prod CSP bi blokiral hydration |
| 🧰 **Infra fix** | `init-pglite.mjs` privzeta mapa usklajena z `db.ts` (`/tmp/pglite-data`) — prej trdo kodiran zunanji path → 9/9 DB invariant integracijskih testov P2021 "table does not exist"; lint cleanup (console → strukturirani logger, `as any` → Prisma tip) |
| 🧪 **Regresija — vse zelene** | lint **0/0** · tsc **0** · **2144/2144 unit** (126 datotek) · **9/9 integracija** |

### ✨ Nove funkcije v v1.8.6 (QA runda 74 — Z-poročilo tiskanje + digest print fix)

| Kategorija | Funkcija |
|------------|----------|
| 🖨️ **Z-poročilo tiskanje / PDF izvoz** | Z-poročilo modul zdaj ima **"Natisni"** gumb — print-only fiskalno oblikovan dokument (isti .print-area vzorec kot račun): monospace, pikčaste vodilne črte, črtkani ločilniki sekcij, žig stanja (ZAKLJUČENO zelen / OSNUTEK amber, rahlo zasukan), DDV tabela po stopnjah, metode plačila + kanali z deleži %, blagajniška reconciliacija z obarvano razliko (uravnoteženo sivo / višek zelen / manko rožnato), FURS/FINA disklejmer v nogi. Deluje prek brskalnikovega "Shrani kot PDF" — brez PDF odvisnosti |
| 🚪 **PORTAL na document.body** | Tiskalni dokument se renderira prek React portala NEHODNO izven POS lupine — lupina ima overflow-hidden verigo + framer-motion transform (motion.div ustvari CSS containing block), kar bi abspos dokument odsekalo/premaknilo. Portal → containing block = začetni → večstranski tisk zanesljiv |
| 🐛 **FIX: digest tisk PRAZNA STRAN (latent od R42!)** | Globalni print CSS je veljal `body * { visibility: hidden }` POVSEOD — strani brez .print-area (digest!) so tiskale prazno stran. Sedaj pogojno: `body:has(.print-area) *` — strani s .print-area (račun, Z-poročilo) fokusiran tisk, strani brez (digest) navaden tisk prek lastnih print: variant. Re-show specificity popravljen (body .print-area = (0,1,1) zmaga po vrstnem redu) |
| 🧰 **`lib/z-report-print.ts`: buildZPrintModel** | Čista funkcija (vzorec R71–R73): sekcije samo z vsebino (DDV vrstice z osnovo > 0, metode/kanali ne-ničelni z deležem % zaokroženim na 1 decimalko), blagajna razlika kind even/surplus/missing (|delta| < 0,005 € = zaokrožitveni šum brez znaka), fail-safe num() (NaN/Infinity/string → 0), `slFullDateLabel`/`slShortDateTime` string-parsing BREZ Intl z obseg-validacijo ('2026-02-30' → '—' — R72 lekcija sistemsko) |
| 🧪 **+23 testov** | buildZPrintModel: sekcije, DDV filtri, deleži (60/35/5, 33.3 zaokroževanje), cash kind (missing/surplus/even/null), dodatki + storno seštevek, dobiček z maržo, fail-safe (null → prazen OSNUTEK, NaN/Inf → 0, nemogoče št. računov ostane VIDEN anomalija), footer disklejmer — **2144/2144 unit (126 datotek)** |

### ✨ Nove funkcije v v1.8.5 (QA runda 73 — Trend vs. predhodno obdobje)

| Kategorija | Funkcija |
|------------|----------|
| 📊 **Trend "vs. predhodnih N dni" čip** | Primerjava trenutnega okna (zadnjih N dni) s PREDHODNIM enako dolgim oknom: ▲ emerald (rast) / ▼ rose (padec) / = muted (flat pri \|delta\|<0,05 %), 1 decimalka, aria-labeli, print-varen (barva nosí pomen — isti vzorec kot 'najboljši dan' amber). BREZ PODLAGE (prevTotal=0) → čip SKRIT — primerjava brez osnove bi goljufala |
| 🔌 **digest-trend API: comparison** | ENA razširjena poizvedba pokrije TRENUTNO (N dni) in PREDHODNO (dni N+1..2N) okno — vedra že imajo ključ po LJ dnevu, rawPrev je samo slice istega bucketiziranega nabora (brez druge povedbe, 2× poceni). Odgovor: `comparison: { prevTotal, deltaPct \| null, direction }` |
| 🧰 **`lib/digest-trend.ts`: computeTrendComparison** | Čista funkcija (vzorec pctChange R65 — deljeni izračun UI+API): fail-safe NaN/negativno → 0, prevTotal≤0 → deltaPct null + flat, zaokroževanje 1 decimalka, flat prag 0,05 % |
| 🧪 **+7 testov** | computeTrendComparison: rast, padec, flat prag, brez podlage (null), fail-safe vhodi, zaokroževanje — **2121/2121 unit (125 datotek)** |

### ✨ Nove funkcije v v1.8.4 (QA runda 72 — Trendi 7/30 dni toggle + mesečna sparkline)

| Kategorija | Funkcija |
|------------|----------|
| 📈 **Trendi toggle 7/30 dni** | Segmentni control v glavi trend sekcije (aria-pressed, print-varen): 7-dnevni tedenski pogled ↔ 30-dnevni mesečni pogled. Sprememba obdobja reloada SAMO trend API (glavni digest ostane — ločen load vzorec R71); fail-tiho (stari trend ostane do uspešnega odgovora). API `?days=` je že podpiral 1..31 (R71) — UI je bila manjkajoča povezava |
| 🗓️ **Mesečna sparkline adaptacija (gost način)** | >14 stolpcev: ozki stolpci (gap 2px, brez max-w), vrednosti SAMO za najboljši dan (brez zmede), tekstovne oznake vsak 5. dan + zadnji + najboljši (showLabel iz lib — brez layout shift-a, prazne celice ohranijo višino vrstice), TEDENSKI LOČILNIKI (črtkana navpična črta na vsak ponedeljek + legenda "začetek tedna"), hover:opacity na stolpcih, title nasveti za VSE stolpce (datum + znesek + št. naročil) |
| 🧰 **`lib/digest-trend.ts` razširitev** | `isWeekStart` (PON detekcija — tedenski ločilnik) + `SPARSE_LABEL_THRESHOLD` (prag 14) + showLabel/isWeekStart na TrendPoint. NOV `parseUTCDateStrict`: polni round-trip range-check — Date.UTC tiho normalizira '2026-02-30' → 1. mar (pon!) — round-trip (konstruirani UTC deli = vhodni) to ujame; aplikirano na OBA helperja (slShortDayLabel + isWeekStart) |
| 🧪 **+8 testov** | `isWeekStart` (3: ponedeljek, ostali dnevi, fail-safe vključno s '2026-02-30'/'2026-02-29' ne-prestopno) + gostota oznak (5: 7 dni vsi, isWeekStart na točkah, 30 dni redke = točno 6, prag 14/15 meja, skaliranje neodvisno od gostote) — **2114/2114 unit (125 datotek)** |

### ✨ Nove funkcije v v1.8.3 (QA runda 71 — Trendi 7 dni sparkline + asArray hardening)

| Kategorija | Funkcija |
|------------|----------|
| 📈 **Trendi — zadnjih 7 dni (nov digest odsek)** | CSS-only sparkline na tiskanem dnevnem povzetku: 7 gradient stolpcev (višine % relativno na najboljši dan), črtkana linija povprečja (pozicionirana na stolpčno območje — dvo-trakasti layout), "najboljši dan" poudarek (amber + ★ čip), izbrani dan ring, legenda (dnevni promet / najboljši dan / povprečje/dan / izbrani dan), čipi Skupaj + Povp./dan, aria-labeli per stolpec, print-varno (višine so %, print-color-adjust: exact) |
| 🔌 **NOV API GET /api/reports/digest-trend** | `?date=YYYY-MM-DD&days=1..31` — okno po LJUBLJANSKEM koledarju (ljubljanaDayBounds, CET/CEST-varen), bucketizacija naročil po LJ dnevih (ljubljanaDateTimeParts — 00:30 UTC = 2:30 LJ spada v pravilni dan), paymentStatus='paid' (Z-report semantika, konsistentno z glavnim digestom), admin auth + rate limit + zod validacija (400/401/429) |
| 🧰 **NOV enoten vir `lib/digest-trend.ts`** | `computeDigestTrend` (čista lib: višine %, najboljši dan, avgLine, duplikati datumov → združi, fail-safe NaN/negativno → 0, obrez na zadnjih N dni, sort ASC) + `slShortDayLabel` (brez Intl, obseg-validacija — Date.UTC tiho normalizira '2026-13-99'!) + `formatEURShort` (ročne tisočice — NE toLocaleString, small-ICU past) |
| 🛡️ **QA-vojen fix: `lib/as-array.ts`** | Produkcija crash "(m \|\| []).map is not a function" (POS:configuration 2026-09-19) — `(x \|\| [])` NE ščiti pred truthy non-array (R69 Happy Hour vzorec: API vrne objekt, koda pričakuje array). `asArray<T>()` (Array.isArray normalizacija) aplikirano na 7 ranljivih klicev: digest page (paymentMethods/topItems), LaborReportsDashboard (3× entries), HistoryTab (2× transactions), HappyHourTab (schedules) |
| 🧪 **+22 testov** | `digest-trend` (13: oznake dni, formatEURShort, skaliranje, najboljši dan, obrez, sort, duplikati, fail-safe, prazni vhodi) + `as-array` (9: array passthrough, truthy objekt/string/NaN/številka, generik) — **2106/2106 unit (125 datotek)** |

### ✨ Nove funkcije v v1.8.2 (QA runda 70 — Vezave dodatkov zaključene: group-side attach + varnost)

| Kategorija | Funkcija |
|------------|----------|
| 📎 **Group-side attach (nov tok)** | `menuItemIds` na skupinah dodatkov je bil VALIDIRAN ampak TIHO IGNORIRAN s strani API-ja — polje za vedno mrtvo. Zdaj: POST /api/modifier-groups ustvari vezave že ob kreaciji skupine, PUT jih zamenja v transakciji (deleteMany + createMany, vzorec PUT /api/menu-items). Scope check: artikli morajo pripadati ISTI lokaciji kot skupina (veriga Category → Menu → locationId) |
| 🛡️ **PUT varnostna pariteta (popravljen realen hole)** | PUT /api/menu-items/[id] je sprejel `modifierGroupIds` BREZ location-scope checka — cross-lokacijska vezava prek PUT je bila možna, čeprav POST jo blokira (MODEL A #9). Zdaj: skupine se preverjajo proti lokaciji artikla, manjkajoč id → 404 z slovenskim sporočilom |
| 🧰 **NOV enoten vir `lib/modifier-attach.ts`** | `dedupeIds` (vrstni red ohranjen, duplikati/prazne/ne-nizi ven — duplikati bi sicer sprožili P2002 unique constraint!) + `attachmentScopeDecision` (requested == inScope sicer 404; FAIL-SAFE NaN/Infinity/negativno/necelo → 400). isti kontrakt za oba API — vzorec R66–R68 guardov |
| 🎨 **ModifierDialog: "Pripni artikle"** | NOVA sekcija v obrazcu skupine dodatkov: iskalni vnos po imenu + checkbox seznam (cap 50 vrstic + hint za ostale, max-h-48 scroll), izbrani čipi z X odstranitvijo, živi števec "N artiklov izbranih" (slCount ARTIKEL_FORMS, aria-live), prazni stanji (ni artiklov / ni zadetkov) |
| ✨ **ItemDialog: izbirne kartice** | Dodatki sekcija povrh: checkbox vrstice → izbirne kartice (CheckCircle2/Circle ikona, ring + bg-primary/5 + shadow pri izbranih, hover border), "N opcij" čip (OPCIJA_FORMS), predogled opcij (prvi 2 + "+N"), "od X €" min doplačilo (formatEUR), števec "N/M izbranih" v glavi, prazno stanje z CTA namigom, sr-only checkboxi + role=group aria |
| 🐛 **R69 zaključena v produkciji** | cb456f71 (GET /api/happy-hour vrne VSE urnike — izklop stikala ni več enosmerna vrata) je zdaj ŽIVO na theta; R69 varnosti tokovi (catch-all 404 JSON, gift-card/loyalty guard 409) verifikovani v produkciji |
| 🧪 **+18 testov** | `dedupeIds` (6: vrstni red, duplikati, prazne, ne-nizi, fail-safe) + `attachmentScopeDecision` (8: ujema/0/mismatch/fail-safe ×4) + schema `menuItemIds` (4: sprejme/opcijsko/prazno/max 200 meja) — **2084/2084 unit (123 datotek)** |

### ✨ Nove funkcije v v1.8.1 (QA runda 68 — Skupine dodatkov DODAJ + UREDI + IZBRIŠI)

| Kategorija | Funkcija |
|------------|----------|
| ➕✏️🗑️ **Dodatki upravljani do konca** | ModifiersTab je bil SAMO read-only prikaz — POST/PUT/DELETE API je obstajal, UI ga ni klical (zadnji neupravljani kot jedilnika: artikli ✓, kategorije ✓ R66, meniji ✓ R67). Zdaj: Dodaj skupino, urejanje z dinamičnimi vrsticami opcij (ime + doplačilo, dodaj/odstrani), Obvezno stikalo + min/max omejitve izbire, izbris s potrditvijo |
| 🛡️ **Zaščita brisanja skupine (popravljen realen bug)** | Prej goli DELETE: join `MenuItemModifierGroup` ima Cascade → izbris skupine bi TIHO odstranil vezave dodatkov z vseh pripetih artiklov. NOV enoten vir `lib/modifier-guard.ts` (`canDeleteModifierGroup`): pripeta artikli > 0 → 409 ("Skupina je pripeta 26 artiklov — izbris bi odstranil dodatke…"); nepripeta → dovoljeno; FAIL-SAFE pokvarjeni števec → blokada |
| 🐛 **FIX: MODEL A locationId pri UI kreaciji** | UI POST menijev (R67 latentni bug!) in skupin dodatkov je padal na 400 "locationId je obvezen" za seje brez dodeljene lokacije (vsi demo zaposleni imajo locationId=null). Mutaciji zdaj pripneta `?locationId=` prve aktivne lokacije (cache, vzorec MultiLocationDashboard); seje Z lokacijo ostanejo pod nadzorom scopa (scope > query — varno) |
| 🎨 **ModifiersTab poliš** | Barvni akcenti (8-barvna paleta po indeksu), ikonska ploščica z hover skaliranjem, čip "N opcij" + badge "pripeta N artiklov" / "ni pripeta" + vsota doplačil, hover uredi/izbriši (dotik: vedno vidna), AlertDialog z blokado (onemogočen gumb + rdeče opozorilo), prazno stanje s CTA |
| 🇸🇮 **+OPCIJA_FORMS** | `sl-plural.ts` dobi družino "opcija" (1 opcija · 2 opciji · 3 opcije · 5 opcij) |
| 🧪 **+10 testov** | `canDeleteModifierGroup` (blokada, ednina, dvojina, dovoljeno pri 0, fail-safe NaN/negativno/Infinity/decimalke) + OPCIJA_FORMS sklanjatev — **2041/2041 unit (120 datotek)** |

### ✨ Nove funkcije v v1.8.0 (QA runda 67 — Meniji UREDI + IZBRIŠI)

| Kategorija | Funkcija |
|------------|----------|
| ✏️🗑️ **Meniji upravljani do konca** | API `/api/menus/[id]` PUT+DELETE je obstajal, UI pa ju ni klical — MenusTab je bil create-only. Zdaj: urejanje (ime, ikona, barva, **stikalo aktivnosti** — prej nedosegljivo brez API klica!) + izbris s potrditvijo |
| 🛡️ **Zaščita brisanja menija (popravljen realen bug)** | Prej goli DELETE: meni z artikli → Prisma P2003 → generični 500; prazne kategorije → TIHA kaskada. NOV enoten vir `lib/menu-guard.ts` (`canDeleteMenu`): artikli > 0 → 409 z razlago ("Meni vsebuje 241 artikel v 18 kategorij — najprej premakni…"); kategorije brez artiklov → dovoljeno + opozorilo o kaskadi; FAIL-SAFE pokvarjeni števci → blokada |
| 🎛️ **Stikalo aktivnosti** | Meni lahko zdaj admin UGASI brez brisanja (neaktiven ni viden prodajalcem) — Switch v urejevalnem dialogu, badge Aktiven/Neaktiven s piko na kartici |
| 🎨 **MenusTab poliš** | Barvni akcent trak, velika ikonska ploščica, čipa "N kategorij"/"N artiklov" (gramatično pravilne sklanjatve — 21 kategorija, 241 artikel), kategorije oblak s "+N" prelive (max 6), hover uredi/izbriši (dotik: vedno vidna), prazno stanje s CTA |
| 🇸🇮 **+MENI_FORMS** | `sl-plural.ts` dobi družino "meni" (1 meni · 2 menija · 3 meniji · 5 menijev) |
| 🧪 **+8 testov** | `canDeleteMenu` (blokada s števci, dvojina, kaskadno opozorilo, prazen, fail-safe NaN/negativno/decimalke, mejni primeri) — **2031/2031 unit (119 datotek)** |

### ✨ Nove funkcije v v1.7.9 (QA runda 66 — Kategorije UREDI + IZBRIŠI)

| Kategorija | Funkcija |
|------------|----------|
| ✏️🗑️ **Kategorije upravljane do konca** | Kategorije so bile create-only (napačno ustvarjena je ostala ZA VEDNO). NOV `/api/categories/[id]`: GET / PUT (ime, ikona, barva, sortOrder, premik med meniji) / DELETE — vzorec menijev [id] PUT+DELETE, admin permission + MODEL A scope prek Menu verige |
| 🛡️ **Referenčna zaščita brisanja** | Kategorija z artikli → 409 z razumljivim slovenskim sporočilom ("Kategorija vsebuje 12 artiklov — najprej premakni …"); ENOTEN VIR `lib/category-guard.ts` (`canDeleteCategory`) za API IN UI; FAIL-SAFE: pokvarjen števec → blokada |
| 🇸🇮 **Slovenski števci kot enoten vir** | `sl-plural.ts` dobi `ARTIKEL_FORMS` (1 artikel · 2 artikla · 3 artikli · 5 artiklov) in `KATEGORIJA_FORMS` (dvojina! — prej trdo kodirano "N kategorij/artiklov" pri 1–4) |
| 🎨 **CategoriesTab poliš** | Barvni akcent trak kategorije, ikonska ploščica, čip "N artiklov" (gramatično pravilen), hover-dejanja uredi/izbriši (na dotiku vedno vidna), prazno stanje po meniju s CTA-klikom, AlertDialog potrditev z blokado ko artikli > 0 |
| 👁️ **Živi predogled v dialogu** | CategoryDialog v urejevalnem načinu: isti vizual kot kartica, se posodablja med izbiro barve/ikone; naslov/gumb se spremenita ("Uredi kategorijo" / "Shrani spremembe") |
| 🧪 **+16 testov** | `canDeleteCategory` (prazna/1/2/3–4/5+/11–14/decimalke/fail-safe NaN), `updateCategorySchema` (partial, hex refine, meje, strip tujih polj), plural forme — **2023/2023 unit (118 datotek)** |

### ✨ Nove funkcije v v1.7.8 (QA runda 65 — Digest primerjava 2.0)

| Kategorija | Funkcija |
|------------|----------|
| 📊 **Polna dnevna primerjava** | Dnevni povzetek je primerjal SAMO promet (prejšnji dan aggregate je poštekal le `_sum.total`). Zdaj primerjava pokrije VSE KPI: promet, naročila, povprečni račun IN napitnine — vsaka z "včeraj" bazo in delta % |
| 📈 **Primerjavna sekcija na tiskani strani** | NOVA sekcija "Primerjava s prejšnjim dnem" na /reports/digest: 4 vrstice z DVOJNIMI CSS vrsticami (danes teal / včeraj siva, proporcionalno na max), vrednosti oba dni + delta čipi (▲/▼, emerald/rdeča); tiskalo-varno (break-inside-avoid, print barve); graciozno stanje "Prejšnji dan ni imel prometa" |
| 🧮 **ENOTEN vir delta izračuna** | NOV `lib/percent-change.ts`: `pctChange(cur, prev)` — čista, strežniško-varna (vzorec tierLabelSi R61b / paymentMethodLabelSl R62); null ko prejšnja vrednost ni primerljiva (0/negativna/NaN → NE "neskončen %"); `revenueChangePct` refaktoriran na isti vir |
| 📧 **Primerjava tudi v emailu** | Email digest (in predogled v Nastavitve → E-pošta) dobi primerjavno kartico Kazalnik/Danes/Včeraj/Sprememba — prikaže se SAMO, ko ima prejšnji dan promet (brez praznih obljub); OPTIONAL polja → stari klicatelji ostanejo združljivi |
| 🧪 **+14 testov** | `pctChange` (rast/padec/zaokroževanje/nič/negativna/NaN/string), polna primerjava agregatov, null baza, query oblika, comparison card render/izpust — **2007/2007 unit (116 datotek)** |

### ✨ Nove funkcije v v1.7.7 (QA runda 64 — KDS opomnik nevarne cone)

| Kategorija | Funkcija |
|------------|----------|
| ⏰ **Zvočni opomnik nevarne cone** | Naročila, ki čakajo ≥ 25 min (rdeča cona OrderCard), dobijo ZVOČNI opomnik vsakih 60 s, dokler ostajajo nebumpirana — prej je bil opomin samo vizualen (kuhar, ki gleda drugam, ga ne sliši); dva kratka visoka G5 piska, razločljiva od prihodnjega trojčka (C5-E5-G5) IN bump potrditve (E5→C5) |
| 🚨 **Rdeči čip v glavi** | Vizualna dvojica opomnika: utripajoči čip z zvončkom (BellRing) + števec naročil v nevarni coni, role=status, aria-label s pravimi sklanjatvami (slCount/NAROCILO_FORMS — dvojina!); animate-pulse samodejno ugasne ob prefers-reduced-motion (WCAG 2.3.3 global) |
| 🧠 **Čista logika v lib** | NOV `lib/kds-reminder.ts`: `shouldRemind` (interval + pogoji) + `countDangerOrders` — testabilna čista logika, hook je tanek ovoj; ref vzorec za getElapsed (session tiktaka vsako sekundo → brez ref-a bi se interval resetiral in NIKOLI ne stekel); React Compiler lekcija: destrukturiraj `getElapsed`, sicer preserve-manual-memoization uveljavlja širši dep |
| 🔇 **Spoštuje preferenco zvoka** | Utišan zaslon (R63 persistenca) ne opominja — pregled preverja isEnabled() ob vsakem tiktaku |
| 🧪 **+6 testov** | `shouldRemind` (prvi pregled takoj, 59 999/60 000 meja, utišan/noben nevarni → nikoli) + `countDangerOrders` (meja 24/25, negativni, konfigurabilen prag) — **1993/1993 unit (115 datotek)** |

### ✨ Nove funkcije v v1.7.6 (QA runda 63 — KDS zvok 2.0)

| Kategorija | Funkcija |
|------------|----------|
| 🔊 **Utišanje preživi reload** | KDS zvok toggle (Task 21) je bil samo v ref — zamenjava izmene/SW update/reconnect in pisk se vrnejo. Zdaj `lib/kds-sound-prefs.ts` (localStorage `kds_sound_enabled`, SSR-safe, samo izrecen `"0"` utiša — pokvarjen zapis → privzeto vklopljeno) |
| 🔓 **Autoplay unlock** | Web Audio politika: kuhinjski zaslon po reloadu NI interaktiral → AudioContext suspended → pisk tiho odpadejo (tihi security alarm!). Prvi pointerdown/keydown odklene (resume + neslišen ton; one-time poslušalca v useKDSPage) |
| 🎛️ **Potrditveni ping + stanjske barve** | Ob vklopu zvoka kratka viž-potrditev (kuhar takoj sliši, da je zvok živ — hkrati odpre AudioContext); gumb zdaj emerald obarvan, ko je VKLOPLJEN (prej ni kazal stanja), aria-pressed + aria-label + tooltip "ostane tudi po osvežitvi" |
| ♿ **A11y obšpil glave** | Vsi ikonski gumbi (pogled, osveži, celozaslonski, postaje) dobili aria-label/aria-pressed/title — screen reader in tipkovnica prej gladko |
| 🧪 **+4 testi** | `loadSoundPref`/`saveSoundPref` (SSR brez storage-a, "1"/"0"/pokvarjen, zapis) — **1987/1987 unit (114 datotek)** |

### ✨ Nove funkcije v v1.7.5 (QA runda 62 — Povzetek na daljavo)

| Kategorija | Funkcija |
|------------|----------|
| 📧 **"Pošlji po e-pošti" na povzetku** | Tiskana stran dnevnega povzetka (/reports/digest) zdaj sproži obstoječi POST /api/reports/digest-send (Task 22) — menedžer natisne IN pošlje iz istega mesta, brez poti prek Nastavitve → E-pošta; idempotentnost API-ja (pending/failed logika) → gumb varen za ponovne klike; živo povratno sporočilo ("Povzetek poslan — 2 uspešno" / "že poslano vsem prejemnikom" / napaka 401/429/5xx) |
| 🇸🇮 **Slovenizacija plačilnih metod — enoten vir** | NOV `lib/payment-methods-sl.ts` (`paymentMethodLabelSl`): tiskani povzetek je do zdaj pokazal surov enum **"cash"** na tiskanem poročilu; zdaj "Gotovina" — in 4 razpršene inline mape (escpos račun, EodPaymentMethods, EodSections, eod-summary-sections) refaktorirane na enoten vir (isti lekcija kot tierLabelSi R61b); dopolnjen zemljevid: loyalty → "Zvestoba", giftcard → "Darilna kartica" |
| 🎨 **Tabelni poliš povzetka** | Ikone plačilnih metod (Gotovina banknote, Kartica kartica, Mobilno telefon …), izmenične vrstice + hover, lestvica Top 5 kot čipi (1. mesto amber) — vse tiskalo-varno (print:bg) |
| 🧪 **+3 testa** | `paymentMethodLabelSl` (vse enum vrednosti, kapitalizacija neznanega, prazne vrednosti) — **1983/1983 unit (113 datotek)** |

### ✨ Nove funkcije v v1.7.4 (QA runda 61b — Zaključitev nivo toka zvestobe)

| Kategorija | Funkcija |
|------------|----------|
| 🏆 **Samodejno povišanje ob ročni prilagoditvi** | Ročni vnos/prilagoditev točk (PUT /api/loyalty/[id]) zdaj SAMODEJNO poviša nivo, če lifetimePoints preseže prag — prej je bil adjust »slep« za pragove (živi dokaz v produkciji: račun z lifetime 543 je ostal Bronast); enak upgrade-only vzorec kot plačilni tok (runda 44) |
| 📱 **SMS o napredovanju — vezava živa** | `triggerTierUpgrade` (prej mrtva koda — nikoli klican) zdaj odide PO commitu v obeh tokovih (plačilo + ročni adjust), fire-and-forget: spodleteli SMS nikoli ne pokvari transakcije; slovenizirana sporočila ("Srebrni" namesto "silver") |
| 🎉 **Praznični toast + odgovorni flag** | API vrne `tierUpgrade:{from,to}` → stiliziran toast (vijolični gradient krog ikone nivoja, perk besedilo, 8 s) |
| 🔮 **Živi predogled v prilagoditvenem dialogu** | Isti izračun kot backend: "S to prilagoditvijo stranka samodejno napreduje v Zlati nivo!" z perk namigom ALI napredna vrstica (vijolični gradient) do naslednjega nivoja — PRED oddajo |
| 🧪 **+6 testov** | `maybeTierUpgrade` (upgrade-only, neznani nivo varno null) + `tierLabelSi` — 1980/1980 unit (112 datotek) |

### ✨ Nove funkcije v v1.7.3 (QA runda 61 — Živi tloris)

| Kategorija | Funkcija |
|------------|----------|
| 🔄 **Avtomatsko osveževanje** | Tloris diha: rezervacije 30 s, mize 45 s (`refetchInterval`, pavza v ozadju) — kollegine akcije (posedljenost, nove rezervacije) se pokažejo brez ročnega osveževanja |
| ⏱️ **Pilula svežine** | "osveženo pred 25 s" (tabular-nums, tik 10 s); > 90 s → amber "zastarelo" stanje (zavihek bil v ozadju) + ročni gumb z vrtinčko (osveži rezervacije + mize hkrati) |
| ⚡ **Utrip spremembe** | Izpeljani status mize (Prosta → Zasedena …) med osvežitvami → 2× utrip primary obroča (~2,1 s) na kanvasu IN fallback mreži; čisti diff prek `diffFloorStatuses` (nove/izbrisane mize ne utripajo) |
| 🧠 **Lib razširitve** | `diffFloorStatuses` (prehodi med dvema zemljevidoma) + `relativeTimeSl` (slovenski relativni čas: pravkar / pred 25 s / pred 3 min / pred 2 h) — +11 testov |
| ✨ **Stilski detajlji** | Živa pika (emerald/amber pulse) v piluli, `animate-live-flash` keyframes (reduced-motion varno), utrip brez vstopnega stagger zamika, desna skupina pilula + urejevalnik |
| 🏷️ **Poliranje besedila** | statusLabels `seated`: "Sedeči" → **"Gost sedeč"** (osebna oblika, enotno z "Ni prišel") — tudi toast "Status spremenjen: Gost sedeč" |

### ✨ Nove funkcije v v1.7.2 (QA runda 60)

| Kategorija | Funkcija |
|------------|----------|
| 🖐️ **Pozicijski urejevalnik tlorisa** | Novi način "Uredi pozicije": vlečenje miz po kanvasu (pointer dogodki = miška + dotik + pisalo, vzorec prodajnega tlorisa), snap na 2 % mrežo, omejeno na robove; **Postavi** gumb na nepozicioniranih mizah → `findFreeTableSlot` najde prvi prost slot (4×6 kandidatska mreža, margin-aware prekrivanje); optimistični overlay + PUT `/api/tables/[id] {posX,posY}`, napaka → povratek + toast |
| 🧠 **Čista geometrijska logika v lib** | `snapFloorPos` (snap + clamp, NaN-varno), `rectsOverlap` (odmik 1 %), `findFreeTableSlot` (kaskadni fallback, nikoli (0,0) — znamenje "nepozicionirana") — +12 testov |
| ✨ **Stilski detajlji urejevalnika** | Poudarjen kanvas (primary okvir + odtenek), lebdeča pilula "UREJANJE — vleci mize", `cursor-grab/grabbing`, vlečena miza: `scale-[1.06]` + `shadow-xl` + `ring-primary` + `transition-none` (trden prijem), nepozicionirane kartice: prekinjen okvir + "Postavi" akcija z vrtinčko, prazno sporočilo kanvasa se prilagodi načinu |
| 🧪 **Kakovost** | 1963/1963 unit testov (111 datotek, +12 geometrija), 0 tsc napak, 0 eslint errorjev |

### ✨ Nove funkcije v v1.7.1 (QA runda 59)

| Kategorija | Funkcija |
|------------|----------|
| ⚡ **Operativni tloris — hitre akcije** | Detail panel tlorisa: gumbi **Posedljeno / Ni prišel / Prekliči / Zaključi** (zrcalijo API `VALID_TRANSITIONS`) — ista mutacija kot kartice; miza ob "Posedljeno" ŽIVO preklopi v Zasedena; izpeljani busy marker (vrtinčka na kliknjenem gumbu, ostali disabled do refetcha) |
| 🛡️ **R59c: varovalka busy + onError toast** | Neuspešen PUT ne zaskoči UI-ja: 8 s timeout sprosti busy (determinističen `useEffect`), `onError` toast pokaže "Statusa ni bilo mogoče spremeniti" (prej tiha napaka, samo konzola) |
| 🇸🇮 **Slovnična očistka — tožilnik po "za"** | Nova družina `OSEBA_TOZILNIK_FORMS`: "premajhna za 2 osebi" (dvojina!), "Ni primernih miz za 3 osebe", "Za 5 oseb" — API 400 kapaciteta napake, čakalna vrsta, javna rezervacijska stran; živa QA ugotovitev runde 59 |
| 🇸🇮 **Pridnevnik "aktivna rezervacija"** | `AKTIVNA_REZERVACIJA_FORMS`: 1 aktivna · 2 aktivni · 3 aktivne · 5 aktivnih (prej ternarek brez oblike 3/4) |
| 🧹 **13 površin sklanjatve** | Javna stran (ConfirmView/CustomerForm/Success), WaitTime ocena + izbirnik, čakalna vrsta + vnosi, SplitPayment (tudi `aria-label`!), table-turnover KPI + vizualni pregled, table-reservation seznami, SMS potrdilo, API capacity napake — vse prek `slCount`/`slPluralWord` |
| ✨ **Stilski detajlji** | Semantične barve akcij (emerald/amber/red/sky — enoten jezik z ReservationCard), staggered `animate-fade-in-up` (cap 240 ms), hover `scale-[1.05]`, `aria-busy` + `aria-label` s pravo sklanjatvijo |
| 🧪 **Kakovost** | 1951/1951 unit testov (111 datotek, +2 slovnični družini), 0 tsc napak, 0 eslint errorjev |

### ✨ Nove funkcije v v1.7.0 (QA runda 58)

| Kategorija | Funkcija |
|------------|----------|
| 🗺️ **Tloris pogled rezervacij** | Novi **"Tloris"** pogled v Rezervacijah: vizualni kanvas z geometrijo miz iz prodajnega tlorisa (posX/posY/oblika/rotacija, runda 43 sinhronizacija), današnje rezervacije kot čipi na mizah ("18:00 · Ana · 4"), izpeljan status mize (prosta/rezervirana/zasedena — enotne barve z orders tlorisom) in **"zdaj"** poudarek za rezervacije v polodprtem oknu [start, end) |
| 🎛️ **Segmentni preklopnik pogledov** | 2-strojni toggle → 3-nivojski segmentni preklopnik (Seznam · Časovni trak · Tloris) z `role=tablist`/`aria-selected`, mobilni krožni fallback; klik na mizo → detail panel z vsemi rezervacijami (preklicane prečrtane, "Uredi" odpre obstoječi dialog) |
| 🧩 **Nov lib `reservation-floorplan`** | Čiste pomožne funkcije: `groupReservationsByTable` (kronološko, brez preklicanih), `deriveTableFloorStatus` (seated ima prednost), `splitTablesByGeometry` (fallback mreža za nepozicionirane mize), `formatFloorChip`/`formatFloorTime` (LJ cona, `--:--` varni nadomestek), `sliceWithMore` ("+N" strnjenež) |
| 🇸🇮 **KDS/kuhinja — glagolsko soglasje (R57c)** | Footer moški rod: "2 čakata", "0 pripravljenih" (`CAKA_GLAGOL_FORMS` + `PRIPRAVLJEN_FORMS`) — živa QA ugotovitev iz produkcijskega QA prehoda |
| ✨ **Stilski detajlji** | Dot-mreža "risovalni papir" ozadje kanvasa, staggered `animate-fade-in-up` vstopi (cap 360 ms), hover lift + `scale-[1.03]`, pulzirajoče statusne pike, `tabular-nums` časi, prazna stanja z ikonami, `aria-label`/`aria-pressed` na mizah, dark-mode variante |
| 🧪 **Kakovost** | 1949/1949 unit testov (111 datotek, +22 floorplan testov), 0 tsc napak, 0 eslint errorjev |

### ✨ Nove funkcije v v1.6.2 (QA runda 57)

| Kategorija | Funkcija |
|------------|----------|
| ⏰ **Opomniki s časovnim žigom** | `reminderSentAt` (schema + migrate faza "R57"): značka pokaže **"Opomnik poslan ob 19:00"** (LJ cona prek `reminderBadgeLabel`); starejše vrstice brez žiga padejo nazaj na suho "Opomnik poslan"; ponastavitev flaga počisti žig (flag+žig ostajata skladna) |
| 🇸🇮 **KDS/kuhinja slovnica — srednji rod** | Eliotske oblike ("naročilo" izpuščeno): `NAROCILO_FORMS` (dvojina "2 naročili" — prej ternarek!), `CAKAJOC_FORMS` (1 čakajoče · 2 čakajoči · 3 čakajoča · 5 čakajočih), `PRIPRAVLJENO_FORMS`, `NUJNO_FORMS` — žive napake "2 čakajočih", "4 nujnih!" popravljene (KDS glava, Kuhinja KPI, Dashboard subtitle) |
| 🐛 **Čip tavtologija fix** | "1 opomnik brez opomnika" → "1 rezervacija brez opomnika" (`REZERVACIJA_FORMS` — čip šteje rezervacije, ne opomnike); živa QA ugotovitev runde 57 |
| ✨ **Stilski detajlji** | `tabular-nums` + `font-medium` na vseh novih badge/števcih (KDS glava, kuhinjski KPI, opomnik značka) — stabilni števci ob live posodobitvah |
| 🔧 **Migrate faza R57** | `/api/admin/migrate` ensure-column za `reminderSentAt` (information_schema check → ALTER TABLE; dry-run/apply vzorec) — sandbox ne doseže Neon 5432, produkcijski stolpec gre prek endpointa |
| 🧪 **Kakovost** | 1918/1918 unit testov (110 datotek), 0 tsc napak, 0 eslint errorjev |

### ✨ Nove funkcije v v1.6.1 (QA runde 55–56)

| Kategorija | Funkcija |
|------------|----------|
| 🖱️ **Rezervacije: drag-to-reschedule** | Potrjena kartica = HTML5 draggable (grip poka, opacity/ring med vleko); slot vrstice = drop targeti z ring/bg tinti; prazen ciljni slot pokaže črtkani placeholder "Spusti za premik na HH:MM"; drop → točen premik (`hmDelta`), 409 konflikti se pravilno ustrežijo prek istega PUT toka ±30 |
| 📊 **Darilne kartice: CSV izvoz zgodovine** | Gumb "Izvozi CSV" v Zgodovini transakcij — točno filtrirana množica; **SI Excel prijazno**: ';' ločilo, decimalna vejica, UTF-8 BOM, CRLF (RFC 4180 ubežanje navedkov/prelomov); LJ čas dd.MM.yyyy HH:mm; zneski brez '+' (SUM v Excelu deluje); datoteka zgodovina-{kartica}-{datum}.csv |
| 📋 **Darilne kartice: izvoz registra** | "Izvozi register" v glavi strani — trenutno filtriran + sortiran seznam kartic (številka, lastnik, status, stanji, datumi); toast z dvojino ("2 kartici") |
| 🇸🇮 **Slovnica KPI darilnic** | "1 neaktivnih ali blokiranih" → `NEAKTIVNA_KARTICA_FORMS` (eliotska ženska oblika: 1 neaktivna ali blokirana · 2 neaktivni ali blokirani · 5+ neaktivnih ali blokiranih) — živa QA ugotovitev runde 56 |
| ✨ **Stilski detajlji** | Status pika v zgodovini (dotColor; utripa samo pri aktivni), referenčna naročila kot monospace chip (zadnjih 8 cuid), export gumbi rounded-full z hover tinti + focus ringi + touch-manipulation |
| 🧪 **Kakovost** | 1900/1900 unit testov (108 datotek), 0 tsc napak, 0 eslint errorjev |

### ✨ Nove funkcije v v1.6.0 (QA runde 52–54)

| Kategorija | Funkcija |
|------------|----------|
| 🇸🇮 **Prava slovenska sklanjatev (dvojina!)** | Enoten vir `sl-plural` (1 rezervacija · 2 rezervaciji · 3 rezervacije · 5+ rezervacij; izjema 11–14; zavestna odstopnica od CLDR, dokumentirana); žive napake na produkciji ("2 rezervacij", "2 oseb") popravljene na karticah, podnaslovih in filtrih |
| 📅 **Rezervacije: hitri premik ±30 min** | Razdeljen gumb pod časovnim chipom na potrjenih karticah; **pravi interval-overlap konflikti** v API (polodprti intervali, dotik robov ≠ konflikt, findMany + ekspliciten overlap — prej findFirst brez orderBy = arbitrarna vrstica); 409 toast z natančnim imenom in časom konflikta |
| 🔔 **Opomniki gostom** | `reminderSent` tok: jantarni gumb "Opomnik" na potrjenih karticah → smaragdna značka "Opomnik poslan"; KPI čip "N brez opomnika" v glavi (prava sklanjatev — `OPOMNIK_FORMS`); flag je bil v shemi od v2.3, neuporabljen |
| 🕐 **Rezervacije: timeline "zdaj" indikator** | Najbližji slot današnjega dneva z amber ringom + pulzirajočo piko; **prava minutna slot matematika** (`reservation-timeline` — prej leksikografska localeCompare razdalja je 15:00 uvrstila v slot 14:00!); črtkana tirnica + števci na prometnih slotih |
| 🐛 **LJ-čas v API sporočilih** | Konfliktno sporočilo je prikazovalo strežniški UTC ("17:00:00" namesto "19:00"); `formatLjubljanaTime` z eksplicitno cono (zimski/letni prehod, sekunde odrezane) |
| 📧 **Digest e-pošta: poljuben datum** | Datumski izbirnik povzetka (predogled/tisk/ponovno pošiljanje za poljuben pretekli dan) + mehka validacija prihodnjega datuma (amber opozorilo + zaklep akcij) |
| 🔧 **Operativna zrelost** | Lock heartbeat (2× kolizija dveh agentov reconciliirana brez izgube dela); deploy postopek z obveznim alias check + hash verifikacijo (4× živi primeri manjkajočega alijasa!) |
| 🧪 **Kakovost** | 1852/1852 unit testov (106 datotek), 0 tsc napak, 0 eslint errorjev — *v v1.6.1 naraščeno na 1900/1900* |

### ✨ Nove funkcije v v1.5.0 (QA runde 42–51)

| Kategorija | Funkcija |
|------------|----------|
| ⭐ **Zvestoba — polni earn/redeem** | Točke se pripnejo in unovčijo na **VSEH treh plačilnih poteh** (eno plačilo, deljeno, po artiklih); tier-aware preview per osebo; preklop "Plačilo s točkami" s predhodnim preverjanjem stanja (prepreči pol-failed split); enoten vir matematike (`split-math`, `redeemPointsNeeded` s kvantizacijo proti float prahu) |
| 🏆 **Tier bonus + samodejno povišanje** | Bonus na prislužene točke po nivoju (bron 0 %, srebro 5 %, zlato 10 %, platinasti 15 %) — backend + živi predogled v plačilnem dialogu; samodejno povišanje nivoja ob prestopu pragov z lastno transakcijo |
| 🕐 **Zgodovina s filtri + KPI** | Zvestoba IN darilne kartice: filter čipi po kategoriji transakcij (prislužene/bonus/povišanje/unovčene/potekle oz. naloženo/porabljeno/prenos/prilagoditev) s števci, živ KPI povzetek filtrirane množice, prazno stanje + "Pokaži vse" — zrcalna generična lib (`loyalty-tx-category`, `gift-card-tx-category`) |
| 📧 **Digest e-pošta: poljuben datum** | Datumski izbirnik povzetka (predogled/tisk/ponovno pošiljanje za poljuben pretekli dan) + mehka validacija prihodnjega datuma (amber opozorilo + zaklep akcij); tisk verzija z istim datumom |
| 📱 **QR menu polish** | Sticky kategorije pod glavo (ResizeObserver merjena višina, snap scrolling, aktivni chip scrollIntoView); FloatingCartBar z iOS safe-area; amber ring na artiklih v košarici |
| 🔄 **PWA pametne posodobitve** | Service Worker v10 z SKIP_WAITING protokolom: samodejni reload ko je stran sveža/ozadje, sicer toast "Nova različica" — varno za naročila v teku |
| 📅 **Rezervacije stil pass** | Statusni časovni chip, leva obroba barve statusa, staggered animacije, aria-pressed filtri statusov |
| 🧱 **Design jezik R42+** | Skupni vzorci: `card-lift` hover, `animate-fade-in-up` staggered (40 ms, respects prefers-reduced-motion), accent zgornji rob, ikonski čipi, `tabular-nums` na vseh zneskih/števcih |
| 🧪 **Kakovost** | 1798/1798 unit testov (102 datotek), 0 tsc napak, 0 eslint errorjev |

### ✨ Nove funkcije v v1.4.0 (QA runde 22–26)

| Kategorija | Funkcija |
|------------|----------|
| 🇭🇷 **CIS — hrvaška fiskalizacija** | Dvojno fiskalno stikalo SI/HR v nastavitvah (FURS ↔ Porezna uprava); ZKI izračun (MD5/RSA, spec-verifyiran iz produkcijske implementacije); RacunZahtjev builder z exact element order + ZKI nad računovim DatVrijeme; **XML-dsig enveloped signature** (exclusive C14N 1.0 — spec-korekcija iz fiskalizacija2 reference) + P12 loading (node-forge); CisTab UI z živim Echo testom — **živi produkcijski FINA strežnik vrača echoed=true na obeh okoljih** |
| 🍳 **KDS Bump sistem (Toast vzorec)** | "Pick-up shelf" — zelena PRIPRAVLJENO sekcija na vrhu kartic, Bump gumb (odjemalec je vzel), Recall (Undo), 4. filter tab "Pripravljeno", emerald ring + glow + pulzirajoč badge na ready naročilih tudi pri natakarju (spot prevzema) |
| ⌨️ **PIN prijava na nivoju Square/Clover** | Fizična tipkovnica (0-9, Backspace, Enter), auto-submit pri max dolžini, haptic feedback (vibrate), dinamične reže 4–6 (Toast vzorec: pri 4 NE oddaja, ker lahko pride 5./6.) |
| ⚡ **Recents hitro ponovno naročilo** | Horizontalna vrstica zadnjih 8 artiklov (zustand persist, LRU dedup, deluje čez kategorije) — 1 tap namesto 5 tapov prek kategorij (Square "Recents" vzorec) |
| 📧 **"Pošlji zdaj" dnevni digest** | Admin sprožen pošiljanje Z-report emaila iz UI, idempotentna logika (pending/failed retry, sent ne duplira), SMTP fix po potrebi |
| 🌙 **Dark mode 100 % pokritost** | Sistematični pregled vseh modulov (WebhookTable, OfflineQueue, KDS OrderCard, ItemDialog, AI Assistant …) — 30+ CSS token zamenjav; fix near-invisible KDS progress bar v light mode |
| 🧱 **Panel layout v4** | Migracija na react-resizable-panels v4 API (Group/Separator) |
| 🧪 **Kakovost** | 1623/1623 unit testov (91 datotek, ~12 s), 0 eslint errorjev, CI 7/7 green |

Podrobnosti: [CHANGELOG](CHANGELOG.md).

### ✨ Nove funkcije v v1.0.3

| Funkcija | Opis |
|----------|------|
| 🛡️ **FURS test mode** | ZOI/EOR simulacija brez certifikata — takoj pripravljen za demo |
| ✨ **AI napovedi** | Gemini AI napovedi prodaje, NL query asistent, glasovno naročanje |
| 🔌 **Self-service integracije** | Stripe, Twilio, Glovo, Wolt, e-Računi — vse v nastavitvah |
| 📧 **Email poročila** | SMTP + avtomatski Z-report emaili |
| 🎨 **Design polish** | Mikro-interakcije, barvno kodiranje (Toast-inspired), KDS timer z glow |
| ⌨️ **Keyboard shortcuts** | Ctrl+1-5 navigacija, Ctrl+N/P/B/D/V akcije, ? za pomoč |
| 🔔 **Notification Center** | Real-time WebSocket obvestila z bell icon in unread badge |
| 📊 **Setup Progress** | Dashboard widget ki pokaže katere nastavitve manjkajo |
| 📋 **OpenAPI / Swagger UI** | Interaktivna API dokumentacija na `/api/docs` |
| 🐳 **Docker Compose** | Self-hosted deployment z PostgreSQL + Redis |
| ⚡ **ETag caching** | 4 endpointi z 304 Not Modified podporo |
| 🔒 **GDPR compliant** | Right to Access + Right to Erasure + data retention cron |
| 📈 **Performance benchmark** | 12/12 endpointov pod 1000ms, 9/12 P95 pod 500ms |

---

## 📊 Tekmovalna analiza (september 2025)

RestaurantOS je bil primerjan z **11 tekmeci** (8 globalnimi + 3 slovenskimi) po **100+ funkcijah** v 6 kategorijah.

| Dimenzija | RestaurantOS | Toast | Square | Lightspeed | EdiPlug |
|-----------|:---:|:---:|:---:|:---:|:---:|
| **Mesečna cena** | 49 EUR | 165 EUR | 0-54 EUR | 89-169 EUR | 35 EUR |
| **TCO 3 leta** | 2.200 EUR | 8.500 EUR | 5.400 EUR | 6.800 EUR | 1.800 EUR |
| **FURS certifikat** | ⏳ Ready (cert pending) | ❌ | ❌ | ❌ | ✅ (zastarelo) |
| **HR fiskalizacija (CIS)** | ✅ ZKI + XML-dsig + živi Echo | ❌ | ❌ | ❌ | ❌ |
| **Multi-tenant** | ✅ (24 TENANT_REQUIRED + 5 OPTIONAL, glej [P0-C4 Classification](docs/P0-C4-CLASSIFICATION.md)) | ✅ | ✅ | ✅ | ❌ |
| **5 jezikov** | ✅ sl/en/it/hr/de | ❌ | ❌ | Delno | ❌ |
| **Varnost (A+)** | ✅ 0 HIGH, 54 security testov, CI 7/7 green, P0-C1..C5 complete | ✅ | ✅ | ✅ | ❌ |
| **Mobilna PWA** | ✅ (SW v10 + pametne posodobitve) | ✅ Native | ✅ Native | ⚠ Slaba | ❌ |

### 📄 Deliverables

- **[RestaurantOS-Tekmovalna-analiza.pdf](download/RestaurantOS-Tekmovalna-analiza.pdf)** (46 strani, 1.7 MB) - podrobna analiza 11 tekmencev z matriko 100+ funkcij, vizualno analizo (UI, design system, UX flow), SWOT in roadmapo
- **[RestaurantOS-Investor-Pitch.pptx](download/RestaurantOS-Investor-Pitch.pptx)** (14 slidov, 1.1 MB) - predstavitev za investitorje z glavnimi ugotovitvami, cenovno primerjavo in ROI modelom
- **[RestaurantOS-P0-GAP-Analiza.pdf](download/RestaurantOS-P0-GAP-Analiza.pdf)** (14 strani, 0.7 MB) - GAP analiza P0 prioritete na podlagi pregleda obstoječe kode (73% pripravljenosti, 8 tednov do konca)
- **[RestaurantOS-P0-Tehnical-Specifikacija.pdf](download/RestaurantOS-P0-Tehnical-Specifikacija.pdf)** (26 strani, 0.3 MB) - tehnična specifikacija za razvojno ekipo: API contracts, TypeScript sheme, React komponente, 30 acceptance criteria
- **[RestaurantOS-P0-Sprint-Plan.xlsx](download/RestaurantOS-P0-Sprint-Plan.xlsx)** (6 sheets, 0.02 MB) - 8-tedenski sprint plan z 42 nalogami, ekipno kapaciteto, registrom tveganj in CSV export za Jira/Linear import
- **[RestaurantOS-P0-E2E-Test-Scenariji.pdf](download/RestaurantOS-P0-E2E-Test-Scenariji.pdf)** (14 strani, 0.24 MB) - 40 E2E testnih scenarijev (FURS 10, Stripe 12, PWA 10, integracijski 8) za QA v sprintih 6-7
- **[RestaurantOS-Production-Runbook.pdf](download/RestaurantOS-Production-Runbook.pdf)** (23 strani, 0.27 MB) - operativna navodila: dnevne rutine, monitoring, incident response (SEV-1 do SEV-4), backup/restore, FURS/Stripe operacije, on-call razpored, post-mortem predloga
- **[RestaurantOS-Client-Onboarding.pdf](download/RestaurantOS-Client-Onboarding.pdf)** (20 strani, 0.27 MB) - sales priročnik: 5 faz onboarding-a (prvi stik → go-live), 40-točkovni kontrolni seznam, predloge emailov, FAQ, hardware priporočila
- **[RestaurantOS-ADR-Zbirka.pdf](download/RestaurantOS-ADR-Zbirka.pdf)** (30 strani, 0.29 MB) - 12 Architecture Decision Records z kontekstom, alternativami in posledicami (Next.js, Neon, Prisma, multi-tenant, PIN auth, FURS, Service Worker, design system, Stripe, audit log, Vercel, i18n)
- **[RestaurantOS-API-Dokumentacija.pdf](download/RestaurantOS-API-Dokumentacija.pdf)** (31 strani, 0.29 MB) - REST API dokumentacija z 60+ dokumentiranimi endpointi, request/response primeri, error handling, rate limiting
- **[openapi.yaml](download/openapi.yaml)** - OpenAPI 3.1 specifikacija za SDK generacijo (Swagger, Postman, codegen)
- **[RestaurantOS-Developer-Guide.pdf](download/RestaurantOS-Developer-Guide.pdf)** (21 strani, 0.26 MB) - onboarding za nove developerje: setup okolja (30 min), arhitektura, kodni standardi (TypeScript/React/API), testiranje, contribution workflow, deployment
- **[RestaurantOS-Security-Audit.pdf](download/RestaurantOS-Security-Audit.pdf)** (22 strani, 0.28 MB) - zgodovinski varnostni audit (A++ → superseded, glej [Security Policy](SECURITY.md) za trenutno A+ oceno po P0-C1..C5 hardening)
- **[RestaurantOS-Database-Schema.pdf](download/RestaurantOS-Database-Schema.pdf)** (23 strani, 0.27 MB) - dokumentacija 94 Prisma modelov v 10 modulih: polja, tipi, relacije, indeksi, multi-tenant izolacija, ER diagrami, query optimization
- **[RestaurantOS-Go-To-Market-Strategy.pdf](download/RestaurantOS-Go-To-Market-Strategy.pdf)** (20 strani, 0.28 MB) - komercialni načrt: tržna analiza (TAM/SAM/SOM), 5 paketov (29-199 EUR), 8 prodajnih kanalov, sales funnel, 12-tedenski content koledar, KPI matrika, tveganja, milniki
- **[restaurantos-postman-collection.json](download/restaurantos-postman-collection.json)** - Postman v2.1 collection z 30+ API request-i, auto-token extraction in test scripts za API testiranje
- **[restaurantos-postman-local.json](download/restaurantos-postman-local.json)** - Postman environment za lokalni razvoj (localhost:3000)
- **[restaurantos-postman-production.json](download/restaurantos-postman-production.json)** - Postman environment za produkcijo (restaurantos.app)
- **[RestaurantOS-CICD-Pipeline.pdf](download/RestaurantOS-CICD-Pipeline.pdf)** (18 strani, 0.25 MB) - CI/CD dokumentacija: GitHub Actions (4 workflow-i), Vercel auto-deploy (3 environment-i), Docker multi-stage, branch protection, secret management, Sentry integracija, rollback, DevOps best practices

### Ključne ugotovitve

- **4x ceneje od Toast**, 2x ceneje od Square pri primerljivi funkcionalnosti
- **FURS-ready Next.js POS** na slovenskem trgu (certifikat pending — pridobitev na eDavki portal)
- **A+ varnostna ocena** (0 HIGH odprtih, 54 security testov, P0-C1..C5 hardening complete) — glej [Security Policy](SECURITY.md) za celoten pregled
- **9.2/10 realna ocena** — production-ready za single-tenant pilot (P0-C1..C5 hardening complete, 1798/1798 unit testov pass)
- **0 kritičnih vrzeli** — vse IDOR/FURS/tenant isolation ranljivosti zaprte. Preostalo: FURS certifikat (pridobitev na eDavki), Stripe production keys, FINA P12.

---

## 🚀 Hitri začetek

### Demo
- **URL:** https://restaurantos-theta.vercel.app
- **Landing page:** https://restaurantos-theta.vercel.app/landing
- **API Docs:** https://restaurantos-theta.vercel.app/api/docs
- **Admin PIN:** Glej `.env.example` (DEMO_ADMIN_PIN) — **nikoli ne uporabljaj 1234 v produkciji**
- **Super-admin PIN:** Glej `.env.example` (DEMO_SUPERADMIN_PIN) — **nikoli ne uporabljaj 5555 v produkciji**
- ⚠️ PIN-i `1234` in `5555` so samo za demo/seed okolje. Produkcija mora imeti unikatne, močne PIN-e.

### ✅ Vercel sinhronizacija (verificirano po rundi 95, commit `cf57f09f`)

- **Produkcija teče R95 kodo** — Vercel auto-deploya vsak push na `main` (GitHub integracija); potrjeno z živimi probe-i: `GET /api/auth/employees` → unified 404 `'Lokacija ni najden'` (R95 endpoint) in `GET /api/qr-menu` → generičen catch-all (R91 izbris)
- **CI + E2E workflow-a zelena na R95 commitu** (GitHub Actions)
- **Vercel Cron** (vercel.json): `/api/cron/outbox` dnevno `0 3 * * *`, `/api/scheduled-emails/process` dnevno `0 2 * * *` — obe ruti fail-closed zaščiteni (`CRON_SECRET`, R82-F)
- ⚠️ **FURS boot guard na produkciji poroča `error`**: `FURS_ALLOW_SIMULATION=true` je v produkciji PREPOVEDAN (R82 boot guard — simulacija proizvaja ne-fiskalizirane račune). Za zeleno health stanje nastavite na Vercel env `FURS_ALLOW_SIMULATION=false` + konfigurirajte certifikat (`FURS_CERT_PATH` ali `Location.fursCertPath`). Do takrat je health `status: error` pričakovano obnašanje guard-a, ne izpad.
- **Verzija**: package.json je bil od runde 84 ostal na 1.9.4 (health je poročal staro verzijo) — bumpano na 1.11.0; naslednji deploy bo poročal pravilno.

### Namestitev (lokalno)

```bash
# 1. Kloniraj
git clone https://github.com/markec12345678/restaurantos.git
cd restaurantos

# 2. Namesti odvisnosti
bun install

# 3. Konfiguriraj .env
cp .env.example .env
# Nastavi DATABASE_URL (Neon PostgreSQL) in NEXTAUTH_SECRET

# 4. Zaženi bazo
bun run db:push

# 5. Seed demo podatki
bun run dev
# Odpri http://localhost:3000/api/seed (kot admin)

# 6. Aplikacija
bun run dev
# Odpri http://localhost:3000
```

### ⚠️ Produkcijsko okolje — obvezne nastavitve (dodano v QA rundi 82)

Runda 82 je zaprla dva fail-open vedenja — **brez teh env spremenljivk produkcija ne bo delovala polno**:

| Env spremenljivka | Učinek, če MANJKA | Kako nastaviti |
|-------------------|-------------------|----------------|
| `QR_PAY_SECRET` | QR-pay **init vrne 503** (fail-closed) — gostje ne morejo plačati prek QR | Vercel env: `openssl rand -hex 32` |
| `CRON_SECRET` | Cron rute (`/api/cron/data-retention`, `/api/cron/outbox`) so zdaj **fail-closed** — brez secret-a zavrnejo VSE klice (prej: anonimen GDPR deleteMany / SMS batchi!) | Vercel env + Vercel Cron header `Authorization` |
| `ENCRYPTION_KEY` + `NEXTAUTH_SECRET` | QR-pay token helper fail-closed (enako pravilo kot QR_PAY_SECRET) | že dolgo obvezna — verify |

**Po namestitvi na PROD obvezno pogni census NULL-location vrstic** (samo branje, brez auto-fix — odločitev o backfillu po pregledu rezultatov):

```bash
DATABASE_URL="<neon-url>" bun scripts/audit-location.ts
```

## 📋 Glavne funkcije

| Modul | Opis | Status |
|-------|------|:---:|
| **POS** | Sprejemanje naročil, mize, plačila, popusti, priljubljeni + Recents 1-tap ponovitev | ✅ |
| **Tablet** | Dotične tarče 44px+ (pointer-coarse), safe areas, floorplan drag | ✅ |
| **KDS** | Kitchen Display System z WebSocket, station filter, sound, **Bump + Recall pick-up shelf** | ✅ |
| **Waiter** | Natakar interfejs z real-time posodobitvami + emerald prevzem signal | ✅ |
| **FURS** | Davčno potrjevanje računov (ZDDV-1), storno, e-invoice book | ⏳ Cert pending |
| **CIS (HR)** | Fiskalno stikalo SI/HR: ZKI, RacunZahtjev + XML-dsig podpis, P12, živi Echo test | ✅ (oddaja: P12 pending) |
| **Zaloga** | Inventory management, HACCP, recepti, purchase orders | ✅ |
| **Računovodstvo** | Trial Balance, P&L, Balance Sheet, Journal Entries | ✅ |
| **Z-Report** | Zapiranje izmene z gotovinskim usklajevanjem + avtomatski osnutek (živ na plošči) | ✅ |
| **Multi-tenant** | Branch isolation z locationId (30+ modelov, glej [Known Issues](docs/KNOWN_ISSUES.md)) | ✅ |
| **Offline** | IndexedDB queue + Background Sync | ✅ |
| **PWA** | Service Worker v10 (pametne posodobitve z toast), offline-capable, installable (push TBD) | ✅ |
| **Plačilni gateway** | Stripe/SumUp integracija | ⏳ P0-2 |
| **Loyalty** | Nivoji bronze→platinasti, earn/redeem na vseh 3 plačilnih poteh, tier bonus, samodejno povišanje, zgodovina s filtri | ✅ |
| **Rezervacije** | Seznam z filtri statusov, datumski kalendar, statusni tok | ✅ |
| **QR menu** | Gost-facing meni s sticky kategorijami, košarico, safe-area | ✅ |

## 🔒 Varnost (pošten status po rundi 94)

**Status:** vsi **potrjeni** HIGH/CRITICAL z datotčnim tokom (R76–R94, 94 QA rund) popravljeni z regresijskimi testi. R85–R94 zaključili sistemske razrede: tenant scope vali (dashboard, delivery-tracking, reports/*, wallet), M2 fail-open razred izkoreninjen, zadnji anonimni globalni fallbacki odstranjeni (P0-C3B kanon: public/menu, public/kiosk, /api/qr-menu izbris), ordering tokeni z revokacijo, 429 kanon na 100 % API površine. Full-suite E2E prvič zelen v CI (204/204 na realnem PostgreSQL). Nadaljnje izboljšave so dokumentiran backlog (npr. dvostopenjska prijava, Table.status flip) — nič od tega ni potrjen aktiven izkoriščljiv HIGH. Klasifikacije in dokazi v [worklogu](docs/FINAL-SUMMARY.md) in [Security Policy](SECURITY.md).

- **CSP** z nonce injection (XSS zaščita)
- **HSTS** z preload (HTTPS enforcement)
- **Rate limiting kanon**: `rateLimitedResponse` (Retry-After + X-RateLimit-Remaining/Reset) na **100 % API površine** — 121 call-siteov/~70 datotek (runde 92–94); Auth 5/15min, API 60/min, Public 20/min; anonimne površine (ai/*, public/*, mobile/*, sms) throttleane pred ostalimi checki; fs-guard test preprečuje nove inline 429 bloke
- **Ordering tokeni**: per-location HMAC token (`v1:<ver>:<hmac>`) obvezen za online-order, revokacija prek `tokenVersion` rotate; delivery webhook envelope za Wolt/Glovo/Bolt (runde 88–91)
- **Tenant scope kanon**: pet primitivov `tenant-scope.ts` (resolver / scope-to-where / write-resolver / isWithinScope / notInScopeResponse — unificiran 404 brez oraklja) na vseh admin/mobilnih/javnih rutah (runde 85–90)
- **PIN hashiranje**: bcrypt + HMAC-SHA256 + per-PIN lockout z delay hardeningom
- **Audit log**: Chain hash (SHA-256, nepopravljiv) + `AuditLog.locationId` tenant model (runda 81)
- **Reports tenant scope**: reports/* (sales/vat/popular/employees/ap-aging/financial/eod/digest-*) — vse scoped na sejo ali platform-gated (runda 84)
- **Wallet tenant binding**: WalletPayment.locationId stolpec + OutboxEvent.locationId + capture/refund scope (runda 84)
- **Multi-tenant isolation**: locationId scoping (30+ modelov; M2 fail-open razred izkoreninjen R86; glej [Known Issues](docs/KNOWN_ISSUES.md))
- **Platform-admin gates**: subscription/invoices, receipts/rebuild+regenerate, journal/regenerate, admin/migrate, webhooks deliveries retry, debug/env (runde 81–93)
- **E2E v CI**: 13 specov / 204 testov na realnem PostgreSQL 16 (`e2e.yml`) + 30-testni security podnabor na produkcijskem buildu (`ci.yml`)
- **Fail-closed cron**: `/api/cron/*` zahteva CRON_SECRET (runda 82 — prej anonimni GDPR delete)
- **QR-pay lifecycle**: HMAC token v2 z TTL 15 min, enkratna uporaba, production secret fail-closed (runda 82)
- **API-key tenant binding**: mobile/order + online-order scoped na naročnino ključa, fail-closed 403 (runda 82)
- **Maintenance sweep**: EOD, bulk-vat, qr-batch, opening-hours, reports/export — vsi scoped na sejo (runda 82)
- **Idempotency**: Orders + Payments (preprečuje duplikate)
- **Optimistic locking**: updatedAt conflict detection (409)
- **SSRF zaščita**: Allow-list za zunanje URL-je
- **GDPR**: Cookie consent, privacy policy, right to erasure

## 📊 Metrike

| Metrika | Vrednost |
|---------|----------|
| Commitov | 981 |
| API rut (route.ts) | 247 |
| React komponent | 816 |
| Prisma modelov | 95 |
| Tabel v bazi | 95 |
| Jezikov | 5 (sl, en, it, hr, de) |
| Unit testov PASS | 3242/3242 (100 %) — 181 datotek, 0 errorjev |
| Integracijskih testov PASS | 9/9 (100 %) |
| E2E testov PASS | 204/204 (100 %) — 13 specov, zeleno v CI na realnem PostgreSQL |
| Varnostna ocena | A++ (potrjeni HIGH/CRITICAL zaprti R76–R94; 429 + tenant scope + token kanoni; glej [Security Policy](SECURITY.md)) |
| Koda (src + tests + scripts) | 255.987 vrstic |
| Odvisnosti | 88 |

## 🧪 E2E Testi

**204/204 zeleno v GitHub Actions** (`e2e.yml`: realni PostgreSQL 16 service, seed en vir resnice `scripts/e2e-seed-data.mjs`, connection pool — produkcijska pariteta; prvič poln suite zelen od R94). Podnabor (core-flow, flow-variants, observability, multi-tenant-security — 30 testov) teče tudi v `ci.yml` na produkcijskem buildu.

| Spec fajl | Fokus |
|-----------|-------|
| cookie-consent | GDPR privolitveni tok |
| core-flow | Osnovni tok: prijava → meni → naročilo → plačilo |
| critical-path | Kritična produkcijska pot |
| dashboard-reports-edge | Dashboard/reports robovi (EDGE-* pini) |
| flow-variants | Variante naročilnih tokov |
| furs-financial | FURS fiskalizacija + finančni tokovi |
| multi-tenant-security | Tenant izolacija (MENU/APIKEY/unificiran-404 pini) |
| observability | Health/monitoring |
| outbox-worker | Outbox webhook delavec |
| payment-flow | Plačilni tokovi |
| setup | Onboarding/seed |
| verify-features | Funkcionalna verifikacija površine |
| workflow | Delovni tokovi (LOGIN/REPORT/LASTNIK pini) |

## 🛠️ Tech Stack

| Kategorija | Tehnologija |
|------------|-------------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Radix UI |
| **Backend** | Next.js API Routes (serverless), Prisma ORM |
| **Database** | PostgreSQL (Neon serverless) |
| **Hosting** | Vercel (Edge + Serverless) |
| **Monitoring** | Sentry (error + performance + replay) |
| **PWA** | Service Worker z Background Sync |
| **i18n** | next-intl (sl, en, it, hr, de) |
| **Auth** | NextAuth + bcrypt + HMAC-SHA256 |
| **Realtime** | WebSocket z auto-reconnect |
| **Validation** | Zod schemas |

## 📁 Struktura projekta

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # 242 API endpointov
│   ├── landing/           # Javna landing page
│   ├── privacy-policy/    # GDPR politika zasebnosti
│   ├── terms-of-service/  # Pogoji uporabe
│   ├── kds/               # Kitchen Display System
│   ├── waiter/            # Natakar interfejs
│   ├── qr-menu/           # Gost-facing QR meni
│   ├── reports/           # Poročila (digest, tisk)
│   └── order-status/      # Sledenje naročil
├── components/            # 679 React komponent
│   └── pos/               # POS moduli (orders, payments, loyalty, gift-cards, reservations...)
├── lib/                   # Poslovna logika
│   ├── auth-middleware/   # PIN auth, session, permissions
│   ├── furs/              # FURS API, ZOI, EOR, QR
│   ├── loyalty-tiers.ts   # Nivoji, tier bonus, redeemPointsNeeded
│   ├── loyalty-tx-category.ts  # Kategorizacija transakcij zvestobe
│   ├── gift-card-tx-category.ts # Kategorizacija transakcij darilnih kartic
│   ├── split-math.ts      # Delitev računa (enoten vir UI + executor)
│   ├── offline-orders/    # IndexedDB queue
│   ├── offline-furs/      # FURS offline queue
│   ├── accounting/        # Journal entries, Trial Balance
│   └── websocket-client/  # WebSocket z auto-reconnect
└── prisma/
    └── schema.prisma      # 95 Prisma modelov
```

## 🗺️ Roadmap (12 mesecev)

### P0 - Kritično (0-3 meseci)
- [ ] P0-1: FURS produkcijska certifikacija (.p12) — zahteva na sd.fu@gov.si
- [ ] P0-2: Stripe/SumUp plačilni gateway
- [x] P0-3: PWA (offline + SW v10 s pametnimi posodobitvami) — push notifications TBD
- [x] P0-4: Sentry monitoring
- [x] P0-5: Custom domena (restaurantos.app)

### P1 - Visoko (3-6 mesecev)
- [x] P1-1: Tablet optimizacija (pointer-coarse 44px tarče: Prodaja, KDS, Mize, plačilni dialog) — mobile-responsive dashboard v nadaljevanju
- [x] P1-8: HR fiskalizacija (CIS) — ZKI + RacunZahtjev + XML-dsig + P12 + živi Echo test ✅ (v1.4.0); za polno oddajo manjka še FINA demo P12 certifikat
- [x] P1-2: Kitchen Display System (KDS) ✅ Implementirano (WebSocket, station filter, sound, bump, fullscreen)
- [ ] P1-3: Spletne naročilne forme na domeni
- [x] P1-4: Loyalty program ✅ (v1.5.0 — nivoji, earn/redeem na vseh plačilnih poteh, tier bonus, zgodovina s filtri)
- [ ] P1-5: Formalni design system (Storybook)
- [x] P1-6: Rezervacijski sistem ✅ (seznam/filtri/statusni tok; Timeline drag v backlogu)
- [x] P1-7: AI napovedi prodaje (osnovni) ✅ (Gemini napovedi + NL query asistent)

### P2 - Srednje (6-12 mesecev)
- [ ] P2-1: AI napovedi (napredni)
- [ ] P2-2: Catering module
- [ ] P2-3: Multi-currency (EU širitev)
- [ ] P2-4: White-label SaaS za distributerje
- [ ] P2-5: Shopify/QuickBooks integracije
- [x] P2-6: Hrvaški davčni sistem (CIS/FINA) — v1.4.0: ZKI + XML-dsig + živi Echo; italijanski ostaja backlog
- [ ] P2-7: Native iOS/Android aplikacija

## 🚀 Deploy na Vercel

1. Fork repozitorija
2. Ustvari nov projekt na Vercel
3. Poveži z Neon PostgreSQL
4. Nastavi environment variables:
   - `DATABASE_URL` — Neon connection string
   - `NEXTAUTH_SECRET` — random string
   - `SENTRY_DSN` — Sentry DSN
   - `FURS_ALLOW_SIMULATION` — `true` za test, **`false` obvezno za produkcijo** (boot guard: produkcija s simulacijo = health `error` + ne-fiskalizirani računi)
5. Deploy!

**Verifikacija po deployu:** `curl -s "https://<domena>/api/health?detailed=true" | jq '{status, version}'` — `status: ok` + trenutna verzija. Vercel Cron se aktivira v Vercel dashboardu (urniki iz `vercel.json`).

## 📄 Dokumentacija

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System diagram, modules, security layers, key flows |
| [Code Review Report](docs/CODE-REVIEW-REPORT.md) | 85 deep checks, 11 fixes, A- security score (historical A++) |
| [Changelog](CHANGELOG.md) | Release notes — vse verzije in popravki |
| [Contributing](CONTRIBUTING.md) | How to contribute — setup, code style, PR process |
| [Security Policy](SECURITY.md) | Vulnerability reporting, OWASP Top 10 status |
| [Code of Conduct](CODE_OF_CONDUCT.md) | Community standards |
| [Client Onboarding](docs/CLIENT-ONBOARDING-GUIDE.md) | Navodila za stranko — setup, dnevno delo, FURS |
| [Production Launch](docs/PRODUCTION-LAUNCH-CHECKLIST.md) | 4-korakni launch plan |
| [Production Readiness](docs/PRODUCTION-READINESS-CHECKLIST.md) | Final checklist — 11 audit rounds, go-live plan |
| [Privacy Policy](docs/PRIVACY-POLICY.md) | GDPR politika zasebnosti |
| [Terms of Service](docs/TERMS-OF-SERVICE.md) | Pogoji uporabe |
| [SLA](docs/SLA.md) | Service Level Agreement — 99.5% uptime, response times, service credits |
| [OpenAPI Spec](openapi.yaml) | OpenAPI 3.1 specifikacija za SDK generacijo (Swagger, Postman) |
| [API Docs (Swagger UI)](/api/docs) | Interaktivna API dokumentacija — /api/docs |
| [Final Summary](docs/FINAL-SUMMARY.md) | Celovit povzetek — 26 audit rund, arhitektura, naslednji koraki |
| [Quick Start](#-hitri-za%C4%8Detek) | 3-korakni setup za developerje |
| [Case Study Template](docs/CASE-STUDY-TEMPLATE.md) | Template za dokumentiranje pilot strank |
| [Video Tutorials](docs/VIDEO-TUTORIALS.md) | 5-video tutorial plan s scenariji |
| [Demo Deployment](docs/DEMO-DEPLOYMENT-GUIDE.md) | Step-by-step demo environment setup guide |
| [Demo Seed](scripts/seed-demo.mjs) | Demo environment seed script — 3 employees, 15 tables, 20 menu items |
| [Tekmovalna analiza PDF](download/RestaurantOS-Tekmovalna-analiza.pdf) | 47-strani globoka analiza 11 tekmencev |
| [Investor Pitch PPT](download/RestaurantOS-Investor-Pitch.pptx) | 14-slidov predstavitev za investitorje |

## 🤝 Prispevanje

Glej [CONTRIBUTING.md](CONTRIBUTING.md) za smernice o prispevanju.

## 🛠️ Alternativni setup (one-click)

### 3-korakni setup

```bash
# 1. Kloniraj in namesti
git clone https://github.com/markec12345678/restaurantos
cd restaurantos
npm install

# 2. Nastavi .env (skripta generira NEXTAUTH_SECRET in vpraša za DATABASE_URL)
node scripts/deploy-oneclick.mjs

# 3. Zaženi development server
npm run dev
```

Odpri http://localhost:3000/setup za setup wizard, nato se prijavi s PIN `1234`.

### Alternativni načini

```bash
# Produkcija (Vercel + Neon)
node scripts/deploy-oneclick.mjs --prod

# Docker Compose (self-hosted z PostgreSQL + Redis)
docker compose up -d

# Performance benchmark
BASE_URL=http://localhost:3000 node scripts/benchmark.mjs
```

### Produkcijski demo

- **URL:** https://restaurantos-theta.vercel.app
- **Landing:** https://restaurantos-theta.vercel.app/landing
- **API Docs:** https://restaurantos-theta.vercel.app/api/docs
- **Health:** https://restaurantos-theta.vercel.app/api/health?detailed=true
- ⚠️ Demo PIN-i (glej `.env.example`) so **samo za demo okolje** — produkcija mora imeti unikatne, močne PIN-e.

## 📜 Licenca

**Dual Licensing** — izberite eno od dveh licenc:

### Option 1: AGPL-3.0 (Open Source)
Brezplačno za osebno uporabo in open-source projekte. Če modificirate
in deployate kot mrežno storitev, MORAte objaviti svojo source kodo
pod AGPL-3.0.

### Option 2: Commercial License (€200/location/month)
Zahtevana za:
- Closed-source / proprietary produkte
- SaaS ponudbe
- White-label rešitve
- Enterprise deployments

Glej [LICENSE](LICENSE) za podrobnosti in cene.

Kontakt: sales@restaurantos.app

## 📞 Kontakt

- **GitHub:** https://github.com/markec12345678/restaurantos
- **Release v1.0.0:** https://github.com/markec12345678/restaurantos/releases/tag/v1.0.0
- **Email:** info@restaurantos.app
- **Security:** security@restaurantos.app

---

<p align="center">
  <em>Zgrajeno z ❤ v Sloveniji · 2025</em>
</p>
