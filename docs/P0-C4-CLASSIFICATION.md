# P0-C4 — Nullable `locationId` Classification & Migration Plan

**Datum:** September 2026
**Status:** Aktivni artifact (uporablja se za P0-C4 implementacijo)
**Avtor:** P0-C4 audit

## Namen tega dokumenta

To NI "dokumentacija za dokumentacijo". To je **aktivni artifact**, ki se takoj uporablja za P0-C4 implementacijo migration v majhnih korakih. Vsaka kategorija (GLOBAL/TENANT_REQUIRED/TENANT_OPTIONAL) določa migration strategijo:

- **TENANT_REQUIRED** → `locationId String?` postane `locationId String` (obvezen) + backfill + FK constraint
- **TENANT_OPTIONAL** → ostane nullable, ampak dodamo indeks + query helper za filter
- **GLOBAL** → odstranimo `locationId` polje (če obstaja slučajno) ker ni smiselno

## Klasifikacija 30 modelov z `locationId String?`

### TENANT_REQUIRED (24 modelov) — `locationId` mora biti obvezen

Ti modeli predstavljajo poslovne entitete, ki **fizično ali logično pripadajo točno eni lokaciji**. Brez `locationId` so podatki brezpomenski ali pa kršijo multi-tenant izolacijo.

| # | Model | Vrstica | Razlog |
|---|-------|:---:|--------|
| 1 | `Menu` | 25 | Meniji se razlikujejo med lokacijami (različne cene, artikli) |
| 2 | `Table` | 397 | Mize so fizično na lokaciji (rezervacija,orderId) |
| 3 | `Order` | 474 | Naročilo vedno pripada eni lokaciji (FURS, COGS, promet) |
| 4 | `Shift` | 792 | Izmene so per-lokacija (vodja izmene, pokritost) |
| 5 | `TimeEntry` | 827 | Delovne ure per-lokacija za plače |
| 6 | `CashRegisterShift` | 869 | Blagajna je fizično na lokaciji |
| 7 | `InventoryItem` | 909 | Zaloga je per-lokacija (vsaka lokacija ima svojo) |
| 8 | `Receipt` | 1009 | Račun je vezan na lokacijo izdajatelja (ZDDV-1) |
| 9 | `DeliveryZone` | 1306 | Cone dostave so per-lokacija |
| 10 | `OpeningHours` | 1334 | Urnik per-lokacija |
| 11 | `HaccpEntry` | 1364 | HACCP per-lokacija (EU 852/2004 — inšpekcije) |
| 12 | `StaffShift` | 1448 | Izmene osebja per-lokacija |
| 13 | `Reservation` | 1560 | Rezervacija za mizo na določeni lokaciji |
| 14 | `PurchaseOrder` | 1738 | Nabava za zalogo lokacije |
| 15 | `GuestFeedback` | 2142 | Povratne informacije per-lokacija |
| 16 | `ZReport` | 2212 | Z-poročilo je dnevni zaključek per-lokacija |
| 17 | `TipPool` | 2246 | Napitnine per-lokacija |
| 18 | `DeliveryTracking` | 2313 | Sledenje dostave per-lokacija |
| 19 | `JournalEntry` | 2406 | Knjigovodski vnosi per-lokacija (issue #31) |
| 20 | `JournalLine` | 2471 | Denormalizirano iz JournalEntry |
| 21 | `AccountsPayable` | 2507 | Obveznosti per-lokacija (issue #31) |
| 22 | `AccountsReceivable` | 2548 | Terjatve per-lokacija (issue #31) |
| 23 | `SustainabilityReport` | 2724 | Poročila per-lokacija |
| 24 | `DeviceRegistry` | 2803 | Naprave so fizično na lokaciji |
| 25 | `VideoAnalyticsSession` | 2940 | Kamere per-lokacija |

**Migration strategija:**
1. Backfill: `UPDATE "Model" SET "locationId" = (SELECT id FROM "Location" WHERE "isActive" = true LIMIT 1) WHERE "locationId" IS NULL`
2. Add NOT NULL constraint: `ALTER TABLE "Model" ALTER COLUMN "locationId" SET NOT NULL`
3. Add FK constraint: `ALTER TABLE "Model" ADD CONSTRAINT "model_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT`
4. Update Prisma schema: `locationId String` (odstrani `?`)

### TENANT_OPTIONAL (4 modeli) — `locationId` ostane nullable

Ti modeli so **hibridni** — nekateri zapisi so globalni (matična družba), drugi per-lokacija. Prisilno `locationId` bi bilo narobe.

| # | Model | Vrstica | Razlog |
|---|-------|:---:|--------|
| 26 | `TaxRate` | 176 | DDV je lahko globalen (ista država) ali per-lokacija (različne države) |
| 27 | `Employee` | 724 | Uslužbenec je lahko na več lokacijah (multi-location worker) |
| 28 | `LoyaltyAccount` | 1053 | Loyalty program je lahko matični (en program za vse) ali per-lokacija |
| 29 | `GiftCard` | 1107 | Darilne kartice so prenosljive med lokacijami (kupiš na A, porabiš na B) |
| 30 | `VirtualBrand` | 2664 | Ghost kitchen brand je lahko hub (več lokacij) ali single-location |

**Migration strategija:**
1. Ostane `String?` (nullable)
2. Dodaj indeks: `@@index([locationId])` (že obstaja za večino)
3. Query helper: `where: { ..., ...(locationId ? { locationId } : {}) }` — že implementirano v P0-C2 helper

### GLOBAL (0 modelov)

Noben od trenutnih modelov z `locationId` ni resnično globalen. Vsi imajo smiselno per-lokacija semantics.

## Migration vrstni red (od najmanj tveganega do najbolj tveganega)

### Phase 1 — Nizko tvegane migration (TENANT_OPTIONAL, samo dodajajo indekse)

Te ne spreminjajo obstoječih constraint-ov, samo dodajo indekse za hitrejše query-je:
- `TaxRate`, `Employee`, `LoyaltyAccount`, `GiftCard`, `VirtualBrand` — already nullable, just verify indexes

### Phase 2 — Nove tabele (ne vplivajo na obstoječe podatke)

- **Nova `ApiKey` tabela** z `subscriptionId` relacijo (nadomesti `RestaurantSettings.apiKeys` JSON)
- To je najmanj tvegano ker ne spreminja obstoječih tabel

### Phase 3 — Dodajanja polj na Location (ne-NOT NULL, z default)

- `Location.emailReportRecipients String @default("[]")`
- `Location.loyaltyEnabled Boolean @default(false)`
- `Location.loyaltyPointsPerEuro Int @default(1)`
- `Location.loyaltyPointsValue Decimal @default(0.01)`
- To so dodatki z defaulti — ne pokvarijo obstoječih podatkov

### Phase 4 — Dodaj `locationId` na Webhook model

- `Webhook.locationId String?` (ostane nullable za backward compat)
- Aktiviraj filter v `triggerWebhook` (odkomentiraj v P0-C3B kodi)
- Ne spreminja obstoječih webhook-ov (so še vedno globalni dokler admin ne dodeli)

### Phase 5 — TENANT_REQUIRED migration (najbolj tvegano)

To je **batch migration** — 24 modelov mora dobiti `NOT NULL` constraint. Strategija:

1. **Backfill script** (Python/TypeScript): za vsak model preveri NULL `locationId` in jih backfill-a:
   - Če ima model `orderId` → preberi `order.locationId`
   - Če ima model `checkId` → preberi `check.order.locationId`
   - Če ima model `receiptId` → preberi `receipt.order.locationId`
   - Sicer → prva aktivna lokacija (z audit log warning)

2. **Postopek** (za vsak model posebej, v majhnih korakih):
   - a) Backfill NULL vrednosti
   - b) Preveri da ni več NULL: `SELECT count(*) FROM "Model" WHERE "locationId" IS NULL` → mora biti 0
   - c) Prisma migration: `ALTER TABLE "Model" ALTER COLUMN "locationId" SET NOT NULL`
   - d) Add FK constraint
   - e) Update Prisma schema: `locationId String` (odstrani `?`)
   - f) Update vse API kode da zahteva `locationId` pri kreaciji

3. **Vrstni red** znotraj Phase 5 (od najmanj odvisnega do najbolj):
   - Najprej: `HaccpEntry`, `SustainabilityReport`, `GuestFeedback` (manj kritični, malo podatkov)
   - Potem: `OpeningHours`, `DeliveryZone`, `DeviceRegistry`, `VideoAnalyticsSession` (config tabele)
   - Potem: `Shift`, `TimeEntry`, `StaffShift`, `CashRegisterShift` (HR tabele)
   - Potem: `InventoryItem`, `PurchaseOrder` (supply chain)
   - Potem: `Reservation`, `DeliveryTracking`, `TipPool`, `ZReport` (operativni)
   - Nazadnje: `Order`, `Receipt`, `JournalEntry`, `JournalLine`, `AccountsPayable`, `AccountsReceivable` (finančni — najbolj kritični)

### Phase 6 — Split `/api/settings` endpoint

- Nov `/api/locations/[id]/settings` endpoint za per-location config
- Nov `/api/api-keys` endpoint za API key management (uporablja novo ApiKey tabelo)
- Stari `/api/settings` postane samo za global config (SMTP, loyalty rules, gratuity, allergen)

## Rollback procedura

Za vsako migration:
1. Prisma migrate shrani `migration.sql` + `migration.lock`
2. Rollback: `prisma migrate resolve --rolled-back <migration_name>` + manual SQL revert
3. Za NOT NULL → NULL rollback: `ALTER TABLE "Model" ALTER COLUMN "locationId" DROP NOT NULL`
4. Za dodana polja: `ALTER TABLE "Model" DROP COLUMN "fieldName"`

## Test plan

Po vsaki migration:
1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → 888+ tests pass
3. `npx eslint src/` → 0 errors
4. `npx prisma validate` → schema valid
5. Manual smoke test: POST /api/orders, POST /api/receipts, POST /api/payments

## KPI-ji za uspeh P0-C4

- 0 modelov z `locationId String?` v TENANT_REQUIRED kategoriji (vsi postanejo `String`)
- 0 NULL `locationId` vrednosti v produkciji (backfill končan)
- 0 cross-tenant leakage v E2E testih
- 0 regression v unit testih (888+ pass)
- Nova `ApiKey` tabela z `subscriptionId` FK
- `/api/settings` razcepljen v 3 endpointe
