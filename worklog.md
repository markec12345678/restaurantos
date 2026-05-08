# RestaurantOS POS - Worklog

---
Task ID: session-3
Agent: Main
Task: Fix all bugs, add missing UI components, implement auth

Work Log:
- Fixed orderType mismatch: takeaway → takeout across 7 files
- Fixed taxRate inconsistency: store.taxRate 0.22 → 22.0 (consistent with MenuItem.vatRate)
- Fixed Receipt model: removed @unique from orderId (enables split payment receipts)
- Created WebhookManager, ShiftManager, PinLogin, UserIndicator
- Registered all components in page.tsx (19 modules total)
- Build verified clean

---
Task ID: session-4
Agent: Main
Task: Implement storno/cancellation workflow for orders

Work Log:
- Added cancelReason, cancelledAt, cancelledBy to Order model
- Soft delete instead of hard delete for audit trail
- Enhanced StornoDialog with FURS reasons and cancel reasons
- Added Preklicano tab, storno badges, paymentStatus labels
- Fixed hardcoded vatRate bug
- Enhanced FURS storno with auto-verified receipt, refunded payments
- Build verified clean

---
Task ID: session-5
Agent: Main
Task: Fullscreen, PWA, tablet/Android install, KDS setup, touch UI

Work Log:
- Enhanced PWA manifest with shortcuts, icons, display: standalone
- Generated PWA icons (192x192, 512x512)
- Created service worker with offline support
- Updated layout.tsx with viewport meta, apple-web-app, service worker registration
- Added fullscreen toggle in Sidebar and KitchenDisplay
- Added useFullscreen hook in KitchenDisplay
- Enhanced touch targets on KDS buttons (h-10, touch-manipulation)
- Added comprehensive touch/tablet/PWA CSS (touch-action, coarse pointer, standalone mode, overscroll, safe area)
- Build verified clean

---
Task ID: session-6
Agent: Main
Task: Network connections research, KDS station filter, waiter functions

Work Log:
- Researched WiFi vs Ethernet vs Bluetooth for POS (Toast, Square, Lightspeed docs)
- Added KDS station filter: Vse/Kuhinja/Šank (filters by food vs drink items)
- KitchenOrderCard now accepts stationFilter prop and displays only relevant items
- Station filter buttons added to KDS header with touch-manipulation
- Documented complete network architecture and hardware setup
- Build verified clean

---
Task ID: 2
Agent: Main
Task: WebSocket server, Kiosk mode, Kitchen Printer API, PWA improvements

Work Log:

## 1. WebSocket Server za Real-Time KDS Komunikacijo

- **`server.js`** — Custom Next.js server z WebSocket podporo (ws package)
  - WSS na poti `/ws` na istem HTTP strežniku (port 3000)
  - Broadcast dogodki: `NEW_ORDER`, `ORDER_UPDATED`, `ITEM_STATUS_CHANGED`, `ORDER_CANCELLED`
  - Heartbeat/ping vsakih 30 sekund za zaznavanje nepovezanih klientov
  - Sledenje povezanih klientov (Set), identifikacija klienta (IDENTIFY sporočilo)
  - Graceful shutdown s SIGINT/SIGTERM
  - `globalThis.__wsBroadcast` izpostavljen za API rute

- **`src/app/api/ws-broadcast/route.ts`** — API ruta za broadcast
  - POST endpoint, ki kliče `globalThis.__wsBroadcast` iz server.js
  - Varno deluje tudi brez WS strežnika (next dev brez server.js)

- **`src/lib/websocket-client.ts`** — Client-side WebSocket hook
  - `useKitchenWebSocket()` hook z auto-reconnect (eksponentna zakasnitev, max 10 poskusov, max 30s)
  - Ob dogodkih samodejno invalidira React Query poizvedbe (kitchen, orders, dashboard)
  - `onEvent` callback za zvok in obvestila
  - Refs za onEvent in connectFn (izogibanje cirkularnim odvisnostim)

- **Posodobljene API rute z WS broadcast:**
  - `orders/route.ts` — broadcast `NEW_ORDER` + auto-print kuhinjskega naročila
  - `order-items/[id]/route.ts` — broadcast `ITEM_STATUS_CHANGED`
  - `orders/[id]/route.ts` — broadcast `ORDER_CANCELLED` in `ORDER_UPDATED`

- **KitchenDisplay.tsx** posodobljen:
  - Uporablja `useKitchenWebSocket()` za real-time posodobitve
  - Ko je WS povezan: polling vsakih 30s (samo za zagotovitev)
  - Ko WS ni povezan: polling vsakih 5s (fallback)
  - Prikaz stanja povezave v footerju (Wifi/WifiOff ikoni)
  - Zvok ob WS dogodkih (NEW_ORDER, ORDER_CANCELLED)

## 2. Kiosk Način

- **`src/lib/store.ts`** — Dodano:
  - `kioskMode: boolean` (privzeto false)
  - `setKioskMode: (mode: boolean) => void`
  - `kioskAllowedModules: string[]` (privzeto ['orders', 'kitchen', 'tables'])
  - `setKioskAllowedModules: (modules: string[]) => void`

- **`src/components/pos/KioskBar.tsx`** — Kompaktna vrstica za kiosk
  - 40px višina, RestaurantOS logotip, moduli tabi (samo kioskAllowedModules), ura
  - Izhod iz kioska zahteva admin PIN (Dialog s števčno tipkovnico)
  - Vsi gumbi touch-friendly (min 44px touch target)
  - Slovenian UI besedila

- **`src/app/page.tsx`** — Posodobljen:
  - Ko je kioskMode true: prikaže KioskBar namesto Sidebar
  - Layout: flex-col z KioskBar na vrhu in main pod njim

- **`src/components/pos/Sidebar.tsx`** — Dodan gumb:
  - "Kiosk način" z Monitor ikono v spodnjem delu stranske vrstice

## 3. Kitchen Printer API (ESC/POS over LAN)

- **`src/lib/escpos.ts`** — ESC/POS ukazni gradilnik
  - Podpora za Epson TM-T88VI (standardni ESC/POS) in Star SP700 (impact printer)
  - Funkcije: init(), bold(), center(), left(), right(), text(), lineFeed(), separator(), cut(), largeText(), smallText(), normalText(), underline(), inverted()
  - Kodna stran 852 (Latin 2) za slovenske znake (č, š, ž, Č, Š, Ž, ć, đ)
  - `generateKitchenOrder()` — ESC/POS podatki za kuhinjsko naročilo
  - `generateReceipt()` — FURS-compliant račun z ZOI, EOR, DDV razčlenitvijo
  - `generateTestPrint()` — Testni tisk

- **`src/app/api/print/route.ts`** — API za tiskanje
  - POST: `{ type: 'order' | 'receipt' | 'test', orderId?, printerId? }`
  - TCP/IP povezava na tiskalnik (port 9100) z 10s timeout
  - Samodejna izbira tiskalnika glede na printRules iz baze
  - Fallback: prvi aktivni tiskalnik, če ni specifičnega pravila
  - PrinterModel določen iz tipa tiskalnika (dot-matrix → Star, thermal → Epson)

## 4. PWA Izboljšave

- **`manifest.json`** posodobljen:
  - `orientation: "landscape"` za tablice (restavracijska uporaba)
  - `prefer_related_applications: true` in `related_applications: []`
  - Dodani shortcuts: "Blagajna", "Mize", "Kuhinja", "Novo naročilo"

- **`layout.tsx`** posodobljen:
  - `<meta name="installable" content="yes">`
  - Body `overscroll-none` razred in `overscroll-behavior: none` style
  - `touchAction: 'manipulation'` na body

- **`sw.js`** posodobljen (v2):
  - Agresivno cahiranje app shell (cache first za statične datoteke)
  - WebSocket zahteve (/ws) niso cahirane
  - Background sync za offline naročila (IndexedDB shranjevanje)
  - Message handler za komunikacijo z aplikacijo
  - Push notification podpora (pripravljeno za prihodnjo uporabo)

## 5. Package.json Scripts

- Dodano: `"dev:ws": "node server.js"` — razvoj z WebSocket
- Dodano: `"start:ws": "NODE_ENV=production node server.js"` — produkcija z WebSocket

## Paketi nameščeni
- `ws` (8.20.0) — WebSocket strežnik
- `@types/ws` (8.18.1) — TypeScript tipi

## Build Status
- Build: ✅ Uspešen (vsi API route-ji vključeni, vključno z /api/print in /api/ws-broadcast)
- Lint: 7 pre-existing napak (page.tsx, GlobalNotifications, ReportsView, SettingsManager) — nobena iz novih datotek
