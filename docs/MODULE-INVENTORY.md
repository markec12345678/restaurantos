# MODULE-INVENTORY (§6)

> ⚙️ GENERIRANO z `scripts/generate-module-inventory.ts` (bun run inventory) — **NE urejati ročno**.
> Vir resnice: `src/lib/modules/registry.ts` (75 modulov × §6 metadata).
> Drift-gate: `tests/unit/lib/module-registry.test.ts` (register ≡ navItems ≡ moduleComponents ≡ i18n ×5).

**75 modulov** · 7 skupin · 6 domen · 43 permission + 32 adminOnly · 12 core / 49 secondary / 14 long-tail

## Prodaja (`sales` · domena: `sales` · 13)

| Modul | Naziv (sl) | Dostop | Prioriteta | Povezani |
|---|---|---|---|---|
| `orders` | Prodaja | take_orders | 🥇 core | `kitchen`, `tables`, `floor-plan` |
| `kitchen` | Kuhinja | take_orders | 🥇 core | `kitchen-stations`, `kitchen-prep`, `orders` |
| `floor-plan` | Tloris | take_orders | 🥇 core | `tables`, `orders` |
| `tables` | Mize | take_orders | 🥇 core | `floor-plan`, `orders`, `reservations` |
| `waitlist` | Čakalna vrsta | take_orders | secondary | `reservations`, `tables` |
| `course-pacing` | Tempo jedi | take_orders | secondary | `orders`, `kitchen` |
| `kitchen-prep` | Kuhinja Pro | take_orders | secondary | `kitchen`, `kitchen-stations` |
| `delivery` | Dostava | take_orders | secondary | `delivery-tracking`, `driver` |
| `delivery-tracking` | Sledenje dostav | take_orders | secondary | `delivery`, `driver` |
| `driver` | Dostave | take_orders | secondary | `delivery`, `delivery-tracking` |
| `wait-time` | Čakalna doba | take_orders | secondary | `waitlist` |
| `kitchen-stations` | Kuhinjske postaje | take_orders | secondary | `kitchen`, `kitchen-prep` |
| `order-bump` | Upsell artikli | take_orders | secondary | `orders` |

## Blagajna (`cash` · domena: `finance` · 5)

| Modul | Naziv (sl) | Dostop | Prioriteta | Povezani |
|---|---|---|---|---|
| `cash-register` | Blagajna | manage_cash | 🥇 core | `z-report`, `end-of-day`, `wallet-payment` |
| `shifts` | Izmene | manage_cash | secondary | `staff-schedule`, `shift-overview` |
| `end-of-day` | Zaključek dneva | manage_cash | secondary | `z-report`, `cash-register` |
| `z-report` | Z-Poročilo | manage_cash | secondary | `end-of-day`, `cash-register` |
| `wallet-payment` | Plačilo z denarnico | manage_cash | secondary | `cash-register` |

## Gosti & CRM (`guests` · domena: `crm` · 7)

| Modul | Naziv (sl) | Dostop | Prioriteta | Povezani |
|---|---|---|---|---|
| `guests` | Gost CRM | take_orders | secondary | `customer-timeline`, `feedback`, `loyalty` |
| `reservations` | Rezervacije | take_orders | 🥇 core | `tables`, `waitlist`, `table-reservation-sync` |
| `feedback` | Mnenja gostov | take_orders | secondary | `guests`, `customer-timeline` |
| `gift-cards` | Darilne kartice | take_orders | secondary | `loyalty` |
| `loyalty` | Zvestoba | take_orders | secondary | `gift-cards`, `guests` |
| `customer-timeline` | Časovnica gosta | take_orders | secondary | `guests`, `feedback` |
| `table-reservation-sync` | Sinhronizacija miz in rezervacij | take_orders | secondary | `reservations` |

## Meni & zaloge (`menu` · domena: `operations` · 12)

| Modul | Naziv (sl) | Dostop | Prioriteta | Povezani |
|---|---|---|---|---|
| `menu` | Meni | admin/manager | 🥇 core | `recipes`, `nutrition`, `allergen-matrix` |
| `food-cost` | Stroški jedi | admin/manager | long-tail | `menu`, `recipes` |
| `inventory` | Zaloga | admin/manager | 🥇 core | `inventory-alerts`, `suppliers`, `waste-tracker` |
| `suppliers` | Dobavitelji | admin/manager | secondary | `vendor-scorecard`, `reorder-center` |
| `reorder-center` | Center naročil | admin/manager | secondary | `inventory-alerts`, `suppliers` |
| `recipes` | Recepti | admin/manager | secondary | `recipe-scaling`, `food-cost`, `menu` |
| `allergen-matrix` | Matrika alergenov | admin/manager | secondary | `menu`, `nutrition` |
| `nutrition` | Nutritivni podatki | admin/manager | long-tail | `menu`, `allergen-matrix` |
| `inventory-alerts` | Opozorila o zalogi | admin/manager | secondary | `inventory`, `reorder-center` |
| `vendor-scorecard` | Ocene dobaviteljev | admin/manager | long-tail | `suppliers` |
| `waste-tracker` | Sledilnik odpadkov | admin/manager | secondary | `inventory` |
| `recipe-scaling` | Skaliranje receptov | admin/manager | long-tail | `recipes` |

## Osebje (`staff` · domena: `operations` · 6)

| Modul | Naziv (sl) | Dostop | Prioriteta | Povezani |
|---|---|---|---|---|
| `staff-schedule` | Razpored zaposlenih | manage_employees | secondary | `shift-overview`, `employees`, `shifts` |
| `staff-performance` | Učinkovitost zaposlenih | view_reports | secondary | `labor-reports`, `employees` |
| `employees` | Zaposleni | manage_employees | 🥇 core | `staff-schedule`, `tip-manager`, `staff-performance` |
| `tip-manager` | Napitnine | manage_employees | secondary | `employees` |
| `shift-overview` | Pregled izmene | manage_employees | secondary | `staff-schedule`, `labor-reports` |
| `labor-reports` | Poročila o delu | view_reports | secondary | `staff-performance`, `shift-overview` |

## Analitika (`analytics` · domena: `insight` · 12)

| Modul | Naziv (sl) | Dostop | Prioriteta | Povezani |
|---|---|---|---|---|
| `dashboard` | Nadzorna plošča | view_reports | 🥇 core | `reports`, `briefing` |
| `ai-forecast` | AI napoved | admin/manager | long-tail | `advanced-analytics`, `ai-recommendations` |
| `table-turnover` | Obračun miz | view_reports | long-tail | `reports` |
| `expenses` | Stroški | view_reports | secondary | `reports` |
| `menu-engineering` | Menu Engineering | admin/manager | long-tail | `menu`, `food-cost` |
| `reports` | Poročila | view_reports | 🥇 core | `dashboard`, `tax-report`, `profit-loss` |
| `advanced-analytics` | Napredna analitika | view_reports | long-tail | `reports`, `ai-forecast` |
| `briefing` | Dnevni pregled | view_reports | secondary | `dashboard`, `reports` |
| `ai-recommendations` | AI Priporočila | admin/manager | long-tail | `ai-forecast` |
| `profit-loss` | Poslovni izid | view_reports | secondary | `reports`, `expenses`, `tax-report` |
| `tax-report` | Davčno poročilo | view_reports | secondary | `reports`, `profit-loss` |
| `ghost-kitchen` | Ghost Kitchen | view_reports | long-tail | `menu`, `orders` |

## Sistem (`system` · domena: `platform` · 20)

| Modul | Naziv (sl) | Dostop | Prioriteta | Povezani |
|---|---|---|---|---|
| `notifications` | Obvestila | manage_cash | secondary | `settings` |
| `daily-checklist` | Kontrolni seznam | take_orders | secondary | `haccp` |
| `haccp` | HACCP | admin/manager | secondary | `compliance` |
| `devices` | Naprave | view_reports | long-tail | `locations` |
| `data-portability` | Prenos podatkov | admin/manager | long-tail | `settings` |
| `configuration` | Konfiguracija | admin/manager | secondary | `settings`, `locations` |
| `multi-location` | Več lokacij | admin/manager | long-tail | `locations` |
| `printers` | Tiskalniki | admin/manager | secondary | `settings` |
| `webhooks` | Webhooki | admin/manager | secondary | `integrations` |
| `integrations` | Integracije | admin/manager | secondary | `webhooks` |
| `furs` | FURS | admin/manager | secondary | `tax-report`, `settings` |
| `locations` | Lokacije | admin/manager | secondary | `multi-location`, `devices`, `configuration` |
| `subscription` | Naročnina | admin/manager | long-tail | `settings` |
| `compliance` | Skladnost | admin/manager | secondary | `haccp`, `audit-log` |
| `audit-log` | Revizijski dnevnik | admin/manager | secondary | `compliance` |
| `outbox` | Outbox nadzor | admin/manager | secondary | `conflicts`, `offline-queue` |
| `conflicts` | Konflikti | admin/manager | secondary | `offline-queue`, `outbox` |
| `offline-queue` | Offline vrsta | admin/manager | secondary | `conflicts`, `outbox` |
| `fraud-detection` | Zaznavanje prevare | admin/manager | secondary | `audit-log` |
| `settings` | Nastavitve | admin/manager | 🥇 core | `configuration`, `printers`, `subscription` |

## Legenda

- **Dostop**: `admin/manager` = adminOnly; sicer zahtevano dovoljenje (`take_orders`, `manage_cash`, `manage_employees`, `view_reports`). Vrata: `canAccessModule()` (Sidebar semantika).
- **Prioriteta**: `core` = Golden Path semena (epic #144 §7); `long-tail` = specialistični moduli; `secondary` = ostalo. Sodbe se spreminjajo z rundami (glej register header).
- **Domena**: groba izpeljava iz skupine (`DOMAIN_BY_GROUP`) — za cockpite/IA (P0 korak 4+).
- Standalone ruta: samo `driver` → `/driver` (ostali moduli živijo v in-app POS plasteh).
