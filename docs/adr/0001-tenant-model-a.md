# ADR-001: Multi-tenant model — MODEL A (vse je lokalno)

- **Status**: SPREJETO (2026-09-09, tenant scope audit)
- **Spremenil**: migracija `prisma/migrations/0003_tenant_model_a/` (v1.3.1)
- **Povezani dokumenti**: `docs/ARCHITECTURE.md`, `DEPLOYMENT.md`, `docs/STAGING_DEPLOYMENT.md`

## Kontekst

Uporabnikova pripomba št. 7 (revizija 2026-09-09): pravila tenant scopinga so bila
**mešana** — najnevarnejša možnost:

| Stanje PRED | Model |
|---|---|
| `Menu.locationId` NULLABLE | implicitno "globalni" meni možen |
| `Table.locationId` NULLABLE | mize brez lokacije (nevidne za scoped GET, a prisotne) |
| `TaxRate.locationId` NULLABLE + delni unique za "globalne" vrstice | globalne + lokalne stopnje so SOOBSTOJALE |
| `DiningOption @@unique([type])` GLOBALNO | **en "dine-in" za VSE najemnike** — druga lokacija ni mogla imeti svojega |
| RevenueCenter, SalesCategory, PriceGroup, ServiceCharge, PrepStation, Printer, PackagingConfig, VoidReason, NoSaleReason, AlternatePaymentType, Discount | **POPOLNOMA globalni** — `GET /api/configuration` je izpisal vse najemnike |

`GET /api/orders` je jemal `menuItemId` iz **katerekoli** lokacije (cross-tenant
injekcija artiklov v naročilo). `diningOption.findFirst({ type })` v public
poteh je bil globalen.

## Odločitev

**MODEL A — vse je lokalno.** Vsak katalog/konfiguracija ima `locationId NOT NULL`.

Zavrnjen alternativni **MODEL B (shared catalog)**: junction tabele
(LocationMenu/LocationPrinter/LocationRevenueCenter) + per-API validacija
dovoljenosti. Zavrnjen, ker bi pomenil VEČJI refactor z višjim regresijskim
tveganjem, obstoječa aplikacija (seeds, `/api/locations/sync`, per-location
unique omejitve iz 0002) pa ŽE sledi semantiki "kopija na lokacijo".

### Pravila (obvezna za VSE prihodnje rake)

1. **Kreacija**: `locationId` se izpelje IZKLJUČNO iz seje
   (`resolveWriteLocationId`); admin brez lokacije MORA podati izrecen
   `?locationId=`. Client podane vrednosti za zaposlene se IGNORIRAJO
   (anti-forgery).
2. **Branje**: `where: locationFilter(scope)` — zaposleni vidi SAMO svojo
   lokacijo; admin brez lokacije = cross-lokacijski NADZOR (ne "bypass").
3. **Veriga**: entitete brez lastnega `locationId` (Category, MenuItem,
   Modifier) se scopeajo PREK starša: `MenuItem → Category → Menu → locationId`.
4. **Deljenje med lokacijami**: IZKLJUČNO eksplicitno — kopija prek
   `/api/locations/sync` (sync-logic kreira kopijo NA CILJNI lokaciji).
   Nikoli implicitna vidljivost.
5. **Sproščanje (delete)**: `ON DELETE CASCADE` — brisanje lokacije pobriše
   njen katalog (lokacija je LASTNIK).

### Obseg (15 modelov, migracija 0003)

NOT NULL + FK + indeks: `Menu`, `Table`, `TaxRate` (obstoječi stolpec
zožen) ter NOV stolpec: `DiningOption` (+ unique `[type, locationId]`,
odstranjen globalni `DiningOption_type_key`), `RevenueCenter`,
`SalesCategory`, `PriceGroup`, `ServiceCharge`, `PrepStation`, `VoidReason`,
`NoSaleReason`, `Printer`, `PackagingConfig`, `AlternatePaymentType`,
`Discount`.

Category/MenuItem/ModifierGroup/Modifier: brez lastnega stolpca — scope prek
verige (pravilo 3).

### Implementacijske točke (vse v tem release-u)

- `src/lib/tenant-scope.ts` — centralni helper (EDINO dovoljeno mesto za
  izpeljavo scope-a).
- `/api/configuration` + `/api/configuration/[tab]`: GET scoped, POST z
  izpeljanim locationId.
- `/api/menus`, `/api/menus/[id]`, `/api/categories`, `/api/menu-items`,
  `/api/menu-items/[id]`, bulk-import: scoped.
- `/api/tables` POST: locationId obvezen.
- Orders money-path: `post-handler` (validacija artiklov na lokaciji
  naročila), `add-items` (isti clamp znotraj transakcije).
- Public poti: `/api/public/order` (dining option + artikli na lokaciji mize),
  `/api/public/online-order` (dining option na lokaciji naročila),
  `/api/public/promo-check` (koda NA lokaciji).
- `/api/discounts`, `/api/discounts/[id]`, `/api/packaging`: scoped.
- `setup/init`, `seed/*`, `scripts/seed/*`: lokacija obvezna (setup → pravkar
  ustvarjena lokacija; demo-seed → prva aktivna, NIKOLI prerazporeditev
  obstoječih vrstic).

### Varovalke

- Migracija 0003: FAIL-CLOSED — vsaka tabela z obstoječimi vrsticami brez
  lokacije BLOKIRA migracijo
  (`Cannot apply NOT NULL migration: unresolved … without locationId`) →
  ročna razrešitev (dodelitev/uvoz/MIGRATION_REVIEW/legacy). NIKOLI
  samodejno "prvi aktivni lokaciji".
- `scripts/verify-db.mjs`: 45 invariant (15× NOT NULL, 15× 0 NULL vrstic,
  DiningOption compound unique, odstranjen globalni unique …).
- E2E `multi-tenant-security.spec.ts` blok **MODEL A** (6 testov:
  loc-2 zaposleni vidi samo svoje, cross-tenant artikel = 400, admin vidi vse).

## Posledice

- Kriptične "globalne" vrstice ne morejo več nastati (NOT NULL na DB nivoju).
- Dodatna lokacija zahteva eksplicitno kopijo kataloga (`/api/locations/sync`
  ali setup) — to je NAMENJENO.
- Vsa obstoječa globalna konfiguracija v starih bazah zahteva ROČNO razrešitev
  pred migracijo (glej sporočilo varovalke).
