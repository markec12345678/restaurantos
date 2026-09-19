# RestaurantOS v1.8.2

[![Version](https://img.shields.io/badge/version-1.8.2-86702b?style=flat-square)](https://github.com/markec12345678/restaurantos/releases)
[![License](https://img.shields.io/badge/license-AGPL--3.0%20%2B%20Commercial-blue?style=flat-square)](LICENSE)
[![Security](https://img.shields.io/badge/security-A%2B%2B-3c7a50?style=flat-square)](SECURITY.md)
[![CI](https://img.shields.io/badge/CI-7%2F7%20green-3c7a50?style=flat-square)](https://github.com/markec12345678/restaurantos/actions)
[![Tests](https://img.shields.io/badge/tests-2084%20unit%20%2B%20149%20E2E-3c7a50?style=flat-square)](tests/)
[![Audit](https://img.shields.io/badge/razvoj-70%20QA%20rund%20complete-426990?style=flat-square)](docs/FINAL-SUMMARY.md)
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

> Pilot-ready POS sistem za restavracije z dvojnim fiskalnim stikalom **FURS (SI) + FINA (HR)**, offline delovanjem, AI napovedmi in multi-tenant arhitekturo. **A++ security** — 0 HIGH, 0 MEDIUM odprtih (70 QA/razvojnih rund complete). Glej [Security Policy](SECURITY.md), [Final Summary](docs/FINAL-SUMMARY.md) in [Production Readiness](docs/PRODUCTION-READINESS-CHECKLIST.md).

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

## 🔒 Varnost (A+ ocena)

- **CSP** z nonce injection (XSS zaščita)
- **HSTS** z preload (HTTPS enforcement)
- **Rate limiting**: Auth 5/15min, API 60/min, Public 20/min
- **PIN hashiranje**: bcrypt (10 rounds) + HMAC-SHA256
- **Audit log**: Chain hash (SHA-256, nepopravljiv)
- **Multi-tenant isolation**: locationId scoping (30+ modelov, glej [Known Issues](docs/KNOWN_ISSUES.md))
- **Idempotency**: Orders + Payments (preprečuje duplikate)
- **Optimistic locking**: updatedAt conflict detection (409)
- **SSRF zaščita**: Allow-list za zunanje URL-je
- **GDPR**: Cookie consent, privacy policy, right to erasure

## 📊 Metrike

| Metrika | Vrednost |
|---------|----------|
| Commitov | 896 |
| API endpointov | 242 |
| React komponent | 679 |
| Prisma modelov | 95 |
| Tabel v bazi | 95 |
| Jezikov | 5 (sl, en, it, hr, de) |
| Unit testov PASS | 1980/1980 (100 %) — 112 datotek, 0 errorjev |
| E2E testov PASS | 144/149 (96.6%) — 5 odprtih, glej [Known Issues](docs/KNOWN_ISSUES.md) |
| Varnostna ocena | A+ (0 HIGH odprtih, P0-C1..C5 complete, glej [Security Policy](SECURITY.md)) |
| Koda (src + tests) | 204.594 vrstic |
| Odvisnosti | 88 |

## 🧪 E2E Testi

| Test | Rezultat |
|------|----------|
| Chaos: DB Failure | 14/14 ✅ |
| Chaos: WebSocket Disconnect | ✅ |
| Chaos: FURS Server Down | 5/6 ✅ |
| Financial: Trial Balance | 14/14 ✅ |
| Financial: Z-Report vs Cash | 8/8 ✅ |
| Financial: DDV vs FURS | 8/8 ✅ |
| FURS: Storno račun | 15/15 ✅ |
| Offline: 100 orders burst | 7/7 ✅ |
| Offline: Sync validation | 10/10 ✅ |
| Offline: Conflict resolution | 8/9 ✅ |
| Multi-tenant: Isolation | 7/7 ✅ |
| Multi-tenant: Shared resources | 39/40 ✅ |
| Multi-tenant: Super-admin | 9/10 ✅ |

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
   - `FURS_ALLOW_SIMULATION` — `true` za test, `false` za produkcijo
5. Deploy!

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
