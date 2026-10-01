# PRODUCT VIDEO STORYBOARD — RestaurantOS

> **Namen:** definitiven storyboard produktnega videa — epik #144 P2 faza, **korak 21**
> ("Finalize #141 product presentation/video"), runda **R188**.
> **Viri:** issue **#141** (dedicated video/presentation execution) · epik #144 **§18**
> (Product evidence and presentation) · epik #144 §21 (acceptance: Product structure /
> Documentation) · modulni register `src/lib/modules/registry.ts` (vir resnice za module).
> **Status:** STORYBOARD READY — snemanje in montaža sta zunanja produkcija (GitHub-only
> dogovor: ta dokument je file-based dokaz; vsak zaslon, modul in pot v njem je
> CI-verificiran proti realni kodi).
>
> **Trajna uveljavitev:** drift-gate `tests/unit/security/r188-video-storyboard.test.ts` —
> (a) vsak modul iz registry se mora pojaviti v prilogi A, (b) vsaka omenjena screen pot
> mora obstajati na datotečnem sistemu, (c) imena konkurence in primerjalne cene so
> negativno pinana, (d) narrativne scene ne smejo vsebovati tehničnih metrik.

---

## 1. Glavna zgodba (§18 real story)

Video pripoveduje **en resničen dan v restavraciji** po epikovi realni zgodbi:

**tla → miza → naročilo → kuhinja → priprava → plačilo → račun → izmena/poročanje → zaloge/nabava → food cost → analitika → poslovni pregled**

Primarno vprašanje, na katerega video odgovarja (iz #141):

> **"Ali RestaurantOS dejansko lahko vodi moj lokal — od naročila do kuhinje do plačila do poročanja?"**

## 2. Pravila prezentacije (§18/#141 — obvezna za vsako sceno)

1. **Uporabi dejanski RestaurantOS UI** — snema se realna aplikacija, ne makete.
2. **Pokaži resnično implementirano zmožnost** — vsaka scena je preslikana na registry
   modul in realno komponento (priloga A).
3. **Brez izmišljenih funkcij** — če zmožnost ni implementirana, je ni v videu.
4. **Brez nepodprtih številk** — nobena metrika brez vira v kodi/podatkih izbrane demo baze.
5. **Brez primerjav s konkurenco** — nobeno konkurenčno ime izdelka ali podjetja, nič
   primerjalnih cenovnih trditev — pravilo #141 dobesedno (negativno pinano v drift-gate testu).
6. **Brez tehničnih metrik kot glavne zgodbe** — število testov/CI ni prodajna zgodba;
   tehnika živi samo v prilogi B (dokazna plast), ne v narrativu.
7. **Brez debug/internega UI** — nobenih dev konzol, feature flagov, admin debug zaslonov.
8. **Brez naključnih osebnih/testnih podatkov** — samo demo podatki iz kontrolirane baze;
   vse kredence označene **DEMO / TEST ONLY** (razdelek 6).
9. **Realna uporabniška izkušnja na prvem mestu** — najprej kaj vidi in naredi uporabnik,
   arhitektura ostane za dokumentacijo.

---

## 3. Zlati pot — operativna zgodba (S1–S8)

| Scena | Moduli (registry) | Screen / ruta | Vsebina v videu |
|---|---|---|---|
| **S1 — Začetek dneva: kokpit** | `danes` | `src/components/pos/danes/DanesCockpit.tsx` | Manager odpre lokal: en pogled pove stanje — aktivne mize, odprta naročila, kuhinjska vrsta, gotovina v blagajni, prihajajoče rezervacije, kritične zaloge. |
| **S2 — Tla restavracije** | `floor-plan`, `tables`, `waitlist`, `reservations` | `src/components/pos/VisualFloorPlan.tsx`, `src/components/pos/TableMap.tsx`, `src/components/pos/WaitlistManager.tsx`, `src/components/pos/ReservationManager.tsx` | Natakar vidi tloris z statusi miz (prosta/zasedena), listo čakajočih gostov in večerne rezervacije — hitra odločitev, kam sedati. |
| **S3 — Naročilo** | `orders`, `menu` | `src/components/pos/OrderPanel.tsx`, `src/components/pos/MenuManager.tsx` | Gost na mizi 12: izbira artiklov s kart, modifikacije (brez čebule, ekstra pikantno), naročilo gre v obrat z enim klikom. |
| **S4 — Kuhinja (KDS)** | `kitchen`, `kitchen-prep`, `kitchen-stations` | `src/components/pos/KitchenDisplay.tsx`, `src/components/pos/KitchenPrepQueue.tsx`, `src/components/pos/KitchenStationManager.tsx`, ruta `/kds` | Na kuhinjskem zaslonu pade novo naročilo; kuhar jemlje, pripravlja, označuje stanja — dvorana in kuhinja dihata sinhrono. |
| **S5 — Tek tečajev** | `course-pacing` | `src/components/pos/CoursePacing.tsx` | Predjed zaključena — sistem uskladi pripravo glavne jedi, da gost ne čaka ne prazne mize ne hladne hrane. |
| **S6 — Plačilo** | `cash-register`, `wallet-payment` | `src/components/pos/CashRegister.tsx`, `src/components/pos/WalletPaymentTerminal.tsx` | Račun: deljeno plačilo med dvema gostoma, izbor posameznih postavk, gotovina in digitalna denarnica — blagajna je zelo preprosta. |
| **S7 — Račun & fiskalizacija** | `furs` | `src/components/pos/FursManager.tsx`, ruta `/receipt` | Izdaja računa s slovenskim fiskalnim kontekstem — potek fiskalizacije je implementiran v aplikaciji (omejitve: razdelek 6). |
| **S8 — Konec dneva** | `end-of-day`, `z-report`, `shifts`, `shift-overview` | `src/components/pos/EndOfDayManager.tsx`, `src/components/pos/ZReportManager.tsx`, `src/components/pos/ShiftManager.tsx`, `src/components/pos/ShiftOverview.tsx` | Zaprtje izmene: štetje gotovine, usklajenost z pričakovano, Z-poročilo finalizirano — dan zaključen z enim potekom. |

## 4. Upravljalna plast — poslovna zgodba (S9–S14)

| Scena | Moduli (registry) | Screen / ruta | Vsebina v videu |
|---|---|---|---|
| **S9 — Offline odpornost** | `offline-queue` | `src/components/pos/offline-queue/OfflineQueueDashboard.tsx` | Povezava pade med servisom: natakar še vedno sprejema naročila; ko se vrsti, se vrsta pošlje — brez podvojenih dogodkov. |
| **S10 — Kart & recepture** | `menu`, `recipes`, `allergen-matrix`, `nutrition`, `recipe-scaling` | `src/components/pos/MenuManager.tsx`, `src/components/pos/RecipeManager.tsx`, `src/components/pos/AllergenMatrix.tsx`, `src/components/pos/NutritionalCalculator.tsx`, `src/components/pos/RecipeScaling.tsx` | Kuharski mojster vzdržuje kart: recepture z normativi, alergeni na enem mestu, skaliranje receptur za večje porabe. |
| **S11 — Zaloge & nabava** | `inventory`, `inventory-alerts`, `reorder-center`, `suppliers`, `vendor-scorecard`, `waste-tracker` | `src/components/pos/InventoryManager.tsx`, `src/components/pos/InventoryAlerts.tsx`, `src/components/pos/reorder/ReorderCenter.tsx`, `src/components/pos/SupplierManager.tsx`, `src/components/pos/VendorScorecard.tsx`, `src/components/pos/WasteTracker.tsx` | Zaloge tečejo z naročili: opozorilo na kritično zalogo → center naročanja → dobavitelj; odpadki so ujeti, ocena dobaviteljev realna. |
| **S12 — Food cost & meni** | `food-cost`, `menu-engineering`, `expenses` | `src/components/pos/food-cost/FoodCostCalculator.tsx`, `src/components/pos/MenuEngineeringMatrix.tsx`, `src/components/pos/expense-tracker/ExpenseTracker.tsx` | Lastnik vidi: koliko ga stane vsaka jed, katera je "zvezda" in katera "pes" menija, kam gredo stroški. |
| **S13 — Analitika & pregled** | `dashboard`, `reports`, `advanced-analytics`, `table-turnover`, `profit-loss`, `tax-report`, `labor-reports`, `briefing`, `wait-time` | `src/components/pos/Dashboard.tsx`, `src/components/pos/ReportsView.tsx`, `src/components/pos/analytics/AdvancedAnalyticsModule.tsx`, `src/components/pos/TableTurnoverAnalytics.tsx`, `src/components/pos/ProfitLossReport.tsx`, `src/components/pos/TaxReport.tsx`, `src/components/pos/LaborReportsDashboard.tsx`, `src/components/pos/briefing/BriefingModule.tsx`, `src/components/pos/WaitTimeEstimator.tsx` | Poslovni pregled: promet, gostje, povprečni račun, obrat miz, uspešnost izmen, fiskalni in davčni poročili — vse iz istih operativnih podatkov, ne ročnih vnosov. |
| **S14 — Osebje & gostje** | `employees`, `staff-schedule`, `staff-performance`, `tip-manager`, `guests`, `customer-timeline`, `feedback`, `loyalty`, `gift-cards` | `src/components/pos/EmployeeManager.tsx`, `src/components/pos/StaffScheduler.tsx`, `src/components/pos/StaffPerformance.tsx`, `src/components/pos/TipManager.tsx`, `src/components/pos/GuestManager.tsx`, `src/components/pos/CustomerTimeline.tsx`, `src/components/pos/CustomerFeedback.tsx`, `src/components/pos/LoyaltyManager.tsx`, `src/components/pos/GiftCardManager.tsx` | Ekipa: urnik, vloge in dostopi, napotki, gost z zgodovino obiskov in povratnimi informacijami, zvestobne točke in darovne kartice — lokal vodi ljudi, ne listov. |

## 5. Naprave, načini dela in jeziki (S15)

| Naprava / način | Ruta | Vloga v zgodbi |
|---|---|---|
| POS terminal / desktop | `/` | Glavni tok: kokpit, naročila, blagajna, upravljanje. |
| Natakar na tablici | `/waiter` | Mize in naročila med servisom — hoja, ne pisarna. |
| Kuhinjski zaslon (KDS) | `/kds` | Scena S4 — brisanje, veliki prikaz za kuhinjo. |
| Kiosik za goste | `/kiosk` | Samopostrežno naročanje na hitri hrani. |
| QR meni na mizi | `/qr-menu`, `/qr/[tableId]` | Gost pregleduje kart in naroča s svojim telefonom. |
| Sledenje naročilu | `/order-status/[orderId]` | Gost vidi status svojega naročila. |
| Spletno naročanje | `/order` | Prevzem naročila od zunaj (prevzem/dostava). |
| Digitalni račun | `/receipt` | Gost odpre račun na telefonu. |
| Prikazovalnik v dvorani | `/display` | Stanje naročil na javnem prikazu. |
| Voznik dostave | `/driver` | Scena S16 — mobilni zaslon voznika. |
| Spletna rezervacija | `/reserve` | Gost rezervira mizo pred obiskom (scena S2). |

**Jeziki:** slovenščina, angleščina, italijanščina, hrvaščina, nemščina (sl/en/it/hr/de) —
zasloni se preklapljajo v sceni S15 (lokalizacija je del uporabniške izkušnje, ne nastavitvena
zadeva za inženirje). **PWA/odzivnost:** tablica in telefon so enakovredne naprave, ne poenostavljeni pogledi.

### 5b — Posebni obrati (S16)

| Scena | Moduli (registry) | Screen / ruta | Vsebina v videu |
|---|---|---|---|
| **S16 — Dostava** | `delivery`, `delivery-tracking`, `driver` | `src/components/pos/DeliveryManager.tsx`, `src/components/pos/DeliveryTracker.tsx`, `src/app/driver/DriverApp.tsx` | Naročilo za dostavo → razdelitev vozniku → sledenje na mobilnem zaslonu voznika — isti sistem, nov način dela. |

## 6. Omejitve, fiskalni kontekst in demo kredence

- **FURS (Slovenija):** potek fiskalizacije je implementiran v aplikaciji (ZOI generiranje in
  FURS konfiguracija so pokriti v testni zaledi projekta); **produkcijska certifikacija je
  pending** — video prikaže implementiran potek in NE trdi certificiranega okolja (epik §21:
  "FURS limitations are explicitly documented"; glej PRODUCT-STATUS za avtoritativno omejitev).
- **Stvarno plačilo/hardver:** pospeševalne kartice/tiskalniki se v videu prikažejo samo v
  obliki, ki jo dejanska koda podpira; fizikalna validacija je ločeno sledena (VALIDATION-MATRIX).
- **Demo kredence — DEMO / TEST ONLY:** vse prijavne PIN-e in demo podatke v snemanju
  označi na ekranu z **"DEMO / TEST ONLY"**. Sandbox PIN-i (npr. demo vrednosti iz
  `.env.example`) veljajo SAMO za demo okolje; produkcija zahteva unikatne močne PIN-e
  (demoPinPolicy — PRODUCT-STATUS). Nič demo kredenci ne sme priti v produkcijsko navodilo.
- **Brez naključnih osebnih podatkov:** demo baza vsebuje izmišljene imena; pred snemanjem
  preveri, da noben resnični podatkovni zapisi ne pridejo v kader.

## 7. Produkcija — vizualni standard (iz #141)

- **Premium produktni videz, cinematic style** — končni produkt mora izgledati kot
  profesionalna predstavitev programske opreme, ne tehnična demo posnetka ali zbirka posnetkov zaslona.
- **Dosledna vizualna identiteta** od začetka do konca (barve, tipografija, ritem rezov).
- **Dejanski UI kot primarni vizualni vir**; naprava makete (POS desktop, tablica, telefon)
  samo kjer izboljšajo razumevanje.
- **Pretakajoči prehodi** med scenami restavracije in UI; zadržana, visokokakovostna grafika
  za razlago pretokov in stanj.
- **Animirane interakcije** kjer pojasnjujejo (npr. pot naročila od mize do KDS), ne okraševanje.
- **Zvok:** mirna pripoved, živi zvok lokala pod pripovedjo — lokal naj zveni kot lokal.

## 8. Zaključna scena (S17)

Povratna iteracija realne zgodbe v enem kadru — **ena platforma, en vir resnice**:
mize → naročila → kuhinja → plačilo → račun → smene → zaloge → nabava → analitika.
Konec: kader lokala ob večeru, zaslon kokpita v ozadju, slogan iz realne zgodbe
("od mize do poročila — brez preklopov med sistemi"). **Brez cen, brez paketov, brez
primerjav** — tisto je ločena prodajna vsebina, ne produktni video.

---

## Priloga A — popolna preslikava modulov (vseh 76 iz registry)

Vir: `src/lib/modules/registry.ts` (76 modulov × 7 skupin). Vsak modul je ali v videu
(scena iz §3–§5) ali izrecno izvzet z razlogom — nič tiho izpuščeno (epik §21: "No
implemented capability is silently lost"). Stolpec Screen je realna komponenta iz
`src/app/components/module-registry.tsx` (drift-gate test fs-verificira vsako pot).

| Modul | Skupina | Screen komponenta | V videu | Opomba |
|---|---|---|---|---|
| `orders` | Prodaja | `src/components/pos/OrderPanel.tsx` | Da (S3) | glavna zgodba, scena S3 |
| `kitchen` | Prodaja | `src/components/pos/KitchenDisplay.tsx` | Da (S4) | glavna zgodba, scena S4 |
| `floor-plan` | Prodaja | `src/components/pos/VisualFloorPlan.tsx` | Da (S2) | glavna zgodba, scena S2 |
| `tables` | Prodaja | `src/components/pos/TableMap.tsx` | Da (S2) | glavna zgodba, scena S2 |
| `waitlist` | Prodaja | `src/components/pos/WaitlistManager.tsx` | Da (S2) | glavna zgodba, scena S2 |
| `cash-register` | Blagajna | `src/components/pos/CashRegister.tsx` | Da (S6) | glavna zgodba, scena S6 |
| `shifts` | Blagajna | `src/components/pos/ShiftManager.tsx` | Da (S8) | glavna zgodba, scena S8 |
| `staff-schedule` | Osebje | `src/components/pos/StaffScheduler.tsx` | Da (S14) | glavna zgodba, scena S14 |
| `course-pacing` | Prodaja | `src/components/pos/CoursePacing.tsx` | Da (S5) | glavna zgodba, scena S5 |
| `dashboard` | Analitika | `src/components/pos/Dashboard.tsx` | Da (S13) | glavna zgodba, scena S13 |
| `guests` | Gosti & CRM | `src/components/pos/GuestManager.tsx` | Da (S14) | glavna zgodba, scena S14 |
| `menu` | Meni & zaloge | `src/components/pos/MenuManager.tsx` | Da (S3) | glavna zgodba, scena S3 |
| `food-cost` | Meni & zaloge | `src/components/pos/food-cost/FoodCostCalculator.tsx` | Da (S12) | glavna zgodba, scena S12 |
| `inventory` | Meni & zaloge | `src/components/pos/InventoryManager.tsx` | Da (S11) | glavna zgodba, scena S11 |
| `suppliers` | Meni & zaloge | `src/components/pos/SupplierManager.tsx` | Da (S11) | glavna zgodba, scena S11 |
| `reorder-center` | Meni & zaloge | `src/components/pos/reorder/ReorderCenter.tsx` | Da (S11) | glavna zgodba, scena S11 |
| `ai-forecast` | Analitika | `src/components/pos/AIForecastDashboard.tsx` | Izbirno (S13) | izbirni rez v analitični sceni |
| `recipes` | Meni & zaloge | `src/components/pos/RecipeManager.tsx` | Da (S10) | glavna zgodba, scena S10 |
| `reservations` | Gosti & CRM | `src/components/pos/ReservationManager.tsx` | Da (S2) | glavna zgodba, scena S2 |
| `staff-performance` | Osebje | `src/components/pos/StaffPerformance.tsx` | Da (S14) | glavna zgodba, scena S14 |
| `kitchen-prep` | Prodaja | `src/components/pos/KitchenPrepQueue.tsx` | Da (S4) | glavna zgodba, scena S4 |
| `notifications` | Sistem | `src/components/pos/NotificationManager.tsx` | Ne | back-office obvestila — intranzitivno za produktni video |
| `allergen-matrix` | Meni & zaloge | `src/components/pos/AllergenMatrix.tsx` | Da (S10) | glavna zgodba, scena S10 |
| `table-turnover` | Analitika | `src/components/pos/TableTurnoverAnalytics.tsx` | Da (S13) | glavna zgodba, scena S13 |
| `expenses` | Analitika | `src/components/pos/expense-tracker/ExpenseTracker.tsx` | Da (S12) | glavna zgodba, scena S12 |
| `daily-checklist` | Sistem | `src/components/pos/DailyChecklist.tsx` | Ne | notranja rutina operaterja — izven produktnega toka |
| `end-of-day` | Blagajna | `src/components/pos/EndOfDayManager.tsx` | Da (S8) | glavna zgodba, scena S8 |
| `haccp` | Sistem | `src/components/pos/HaccpManager.tsx` | Ne | nišni skladnostni modul — izven glavnega toka |
| `employees` | Osebje | `src/components/pos/EmployeeManager.tsx` | Da (S14) | glavna zgodba, scena S14 |
| `menu-engineering` | Analitika | `src/components/pos/MenuEngineeringMatrix.tsx` | Da (S12) | glavna zgodba, scena S12 |
| `feedback` | Gosti & CRM | `src/components/pos/CustomerFeedback.tsx` | Da (S14) | glavna zgodba, scena S14 |
| `reports` | Analitika | `src/components/pos/ReportsView.tsx` | Da (S13) | glavna zgodba, scena S13 |
| `advanced-analytics` | Analitika | `src/components/pos/analytics/AdvancedAnalyticsModule.tsx` | Da (S13) | glavna zgodba, scena S13 |
| `danes` | Analitika | `src/components/pos/danes/DanesCockpit.tsx` | Da (S1) | glavna zgodba, scena S1 |
| `briefing` | Analitika | `src/components/pos/briefing/BriefingModule.tsx` | Da (S13) | glavna zgodba, scena S13 |
| `devices` | Sistem | `src/components/pos/devices/DevicesModule.tsx` | Ne | inventar naprav — back-office nastavitve |
| `data-portability` | Sistem | `src/components/pos/portability/DataPortabilityModule.tsx` | Ne | GDPR arhiv — back-office |
| `configuration` | Sistem | `src/components/pos/ConfigurationManager.tsx` | Ne | sistemska konfiguracija — back-office |
| `delivery` | Prodaja | `src/components/pos/DeliveryManager.tsx` | Da (S16) | glavna zgodba, scena S16 |
| `delivery-tracking` | Prodaja | `src/components/pos/DeliveryTracker.tsx` | Da (S16) | glavna zgodba, scena S16 |
| `driver` | Prodaja | `src/app/driver/DriverApp.tsx` | Da (S16) | glavna zgodba, scena S16 |
| `z-report` | Blagajna | `src/components/pos/ZReportManager.tsx` | Da (S8) | glavna zgodba, scena S8 |
| `tip-manager` | Osebje | `src/components/pos/TipManager.tsx` | Da (S14) | glavna zgodba, scena S14 |
| `wait-time` | Prodaja | `src/components/pos/WaitTimeEstimator.tsx` | Da (S13) | glavna zgodba, scena S13 |
| `multi-location` | Sistem | `src/components/pos/MultiLocationDashboard.tsx` | Ne | več-lokacijski pregled — back-office; omemba brez zaslona |
| `ai-recommendations` | Analitika | `src/components/pos/AIRecommendations.tsx` | Izbirno (S13) | izbirni rez v analitični sceni |
| `nutrition` | Meni & zaloge | `src/components/pos/NutritionalCalculator.tsx` | Da (S10) | glavna zgodba, scena S10 |
| `gift-cards` | Gosti & CRM | `src/components/pos/GiftCardManager.tsx` | Da (S14) | glavna zgodba, scena S14 |
| `loyalty` | Gosti & CRM | `src/components/pos/LoyaltyManager.tsx` | Da (S14) | glavna zgodba, scena S14 |
| `printers` | Sistem | `src/components/pos/PrinterManager.tsx` | Ne | nastavitev tiskalnikov — namestitev, ne uporabniška zgodba |
| `webhooks` | Sistem | `src/components/pos/WebhookManager.tsx` | Ne | integracijska konfiguracija — tehnično |
| `integrations` | Sistem | `src/components/pos/IntegrationManager.tsx` | Ne | integracijska konfiguracija — tehnično |
| `furs` | Sistem | `src/components/pos/FursManager.tsx` | Da (S7) | glavna zgodba, scena S7 |
| `locations` | Sistem | `src/components/pos/LocationManager.tsx` | Ne | nastavitev lokacij — namestitev |
| `subscription` | Sistem | `src/components/pos/SubscriptionManager.tsx` | Ne | naročnina — poslovni admin, ne obratovalna zgodba |
| `inventory-alerts` | Meni & zaloge | `src/components/pos/InventoryAlerts.tsx` | Da (S11) | glavna zgodba, scena S11 |
| `customer-timeline` | Gosti & CRM | `src/components/pos/CustomerTimeline.tsx` | Da (S14) | glavna zgodba, scena S14 |
| `shift-overview` | Osebje | `src/components/pos/ShiftOverview.tsx` | Da (S8) | glavna zgodba, scena S8 |
| `profit-loss` | Analitika | `src/components/pos/ProfitLossReport.tsx` | Da (S13) | glavna zgodba, scena S13 |
| `table-reservation-sync` | Gosti & CRM | `src/components/pos/TableReservationSync.tsx` | Ne |  |
| `kitchen-stations` | Prodaja | `src/components/pos/KitchenStationManager.tsx` | Da (S4) | glavna zgodba, scena S4 |
| `tax-report` | Analitika | `src/components/pos/TaxReport.tsx` | Da (S13) | glavna zgodba, scena S13 |
| `vendor-scorecard` | Meni & zaloge | `src/components/pos/VendorScorecard.tsx` | Da (S11) | glavna zgodba, scena S11 |
| `order-bump` | Prodaja | `src/components/pos/OrderBump.tsx` | Ne |  |
| `waste-tracker` | Meni & zaloge | `src/components/pos/WasteTracker.tsx` | Da (S11) | glavna zgodba, scena S11 |
| `recipe-scaling` | Meni & zaloge | `src/components/pos/RecipeScaling.tsx` | Da (S10) | glavna zgodba, scena S10 |
| `compliance` | Sistem | `src/components/pos/ComplianceDashboard.tsx` | Ne | skladnostni dashboard — back-office |
| `audit-log` | Sistem | `src/components/pos/AuditLogViewer.tsx` | Ne | revizijski dnevnik — back-office (intranzitivno) |
| `outbox` | Sistem | `src/components/pos/OutboxDashboard.tsx` | Ne | notranje izhajajoče sporočilo vrsta — tehnično |
| `ghost-kitchen` | Analitika | `src/components/pos/GhostKitchenHub.tsx` | Ne | nišni obratovalni način — izven glavnega toka |
| `conflicts` | Sistem | `src/components/pos/ConflictResolutionDashboard.tsx` | Ne | reševanje konfliktov — tehnično ozadje |
| `offline-queue` | Sistem | `src/components/pos/offline-queue/OfflineQueueDashboard.tsx` | Da (S9) | glavna zgodba, scena S9 |
| `wallet-payment` | Blagajna | `src/components/pos/WalletPaymentTerminal.tsx` | Da (S6) | glavna zgodba, scena S6 |
| `fraud-detection` | Sistem | `src/components/pos/FraudDetectionDashboard.tsx` | Ne | varnostno ozadje — intranzitivno |
| `labor-reports` | Osebje | `src/components/pos/LaborReportsDashboard.tsx` | Da (S13) | glavna zgodba, scena S13 |
| `settings` | Sistem | `src/components/pos/SettingsManager.tsx` | Ne | sistemske nastavitve — namestitev |


## Priloga B — dokazna plast (evidence chain)

- **Modulni register (vir resnice):** `src/lib/modules/registry.ts` — 76 modulov, 7 skupin
  (Prodaja, Blagajna, Gosti & CRM, Meni & zaloge, Osebje, Analitika, Sistem); drift-gate
  `tests/unit/lib/module-registry.test.ts` (register ≡ navItems ≡ moduleComponents ≡ i18n ×5).
- **Komponentno mapiranje:** `src/app/components/module-registry.tsx` (lazy-loaded map
  id → komponenta) — vsa Screen poti v tem dokumentu so fs-verificirane v drift-gate testu
  `tests/unit/security/r188-video-storyboard.test.ts`.
- **Zlati pot (§7 epika):** Table → order → kitchen → payment → receipt → close je E2E
  verificiran (core-flow GOLDEN PATH 22/22 na realni PG bazi — E2E suite v CI).
- **Zapiralni kanon smene (S8):** closeShiftCasIfOpen — enoten CAS po R185
  (vsi trije pisci CashRegisterShift).
- **CI dokaz za to rundu:** run 36824838355 @ 5315e89e (7/7 jobov + Monitor ×2) + E2E run
  36824838347 (234 passed / 4 skipped) — številke iz CI logov; avtoritativno: PRODUCT-STATUS
  → ciLastFileBasedProof.
- **Storyboard drift-gate:** `tests/unit/security/r188-video-storyboard.test.ts` —
  pokritost vseh registry modulov v prilogi A, fs-verification Screen poti in rut,
  negativni pini konkurence/primerjalnih cen/tehničnih metrik v narrativu, DEMO markacija.
- **Zgodovinski video dokumenti:** `docs/VIDEO-TUTORIALS.md` je označen kot zgodovinski
  (prejšnji načrt 5 tehničnih videov) — nadomešča ga ta storyboard po #141 smernicah.

## Priloga C — iz priloge A v snemalni načrt

- **Da (53 modulov):** razporejeni po scenah S1–S16 (zgoraj) — glavni tok videa.
- **Izbirno (2):** ai-forecast, ai-recommendations — rez samo, če montaža potrebuje
  širino analitične scene; ne smejo zasenčiti realne zgodbe.
- **Ne (21):** back-office/sistemska/integracijska (priloga A, stolpec Opomba) —
  njihova zmožnost ostane v produktu, v produktnem videu namenoma niso.
