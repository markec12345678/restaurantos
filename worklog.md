# RestaurantOS POS - Worklog

---
Task ID: 7
Agent: Main
Task: Apply critical frontend fixes (C-10, C-11, C-08, C-13, C-14, M-16, H-15, H-19, H-20, H-22)

Work Log:

## FIX 1: C-10 — Remove admin role from skip login guest
- Changed guest user from `role: 'admin', permissions: ['admin']` to `role: 'guest', permissions: ['take_orders', 'view_reports']`
- File: src/app/page.tsx

## FIX 2: C-11 — Add auth-expired event listener
- Added useEffect that listens for 'pos:auth-expired' custom event
- Resets auth state and clears sessionStorage on event
- File: src/app/page.tsx

## FIX 3: C-08 — Fix DDV calculation with discounts in store
- Updated cartVatBreakdown() to distribute discount proportionally across VAT rate bases
- Updated cartTotal() to recalculate tax on discounted bases instead of applying discount after tax
- Key principle: Discount reduces the taxable base, VAT is calculated on the reduced base
- File: src/lib/store.ts

## FIX 4: C-13 — Fix split payment rounding
- Split amount now uses Math.floor to avoid floating-point rounding errors
- Last payment absorbs the difference: `totalWithTip - splitAmount * (splitCount - 1)`
- Tip portions also use the same rounding strategy
- File: src/components/pos/PaymentDialog.tsx

## FIX 5: C-14 — Fix cash change calculation to use React state
- Added `cashReceived` state variable and `cashChange` derived value
- Replaced `document.getElementById('cash-change-display')` DOM manipulation with React state-based rendering
- Cash change color changes dynamically based on state
- File: src/components/pos/PaymentDialog.tsx

## FIX 6: M-16 — Fix defaultValue on cash received input
- Changed from `defaultValue` to controlled `value` prop on cash received Input
- onChange now sets `cashReceived` state via `setCashReceived`
- File: src/components/pos/PaymentDialog.tsx

## FIX 7: H-15 — Cap discount to subtotal in OrderPanel
- Added `cappedDiscount = Math.min(discount, subtotal)` 
- Applied cap to both display total and server payload
- File: src/components/pos/OrderPanel.tsx

## FIX 8: H-19 — Replace fetch() with authFetch() in 9 components
- Replaced all `fetch('/api/...')` with `authFetch('/api/...')` in:
  - OrderPanel.tsx (5 fetch calls)
  - CashRegister.tsx (4 fetch calls)
  - Dashboard.tsx (1 fetch call)
  - EmployeeManager.tsx (6 fetch calls)
  - SettingsManager.tsx (2 fetch calls)
  - TableMap.tsx (5 fetch calls)
  - GiftCardManager.tsx (5 fetch calls)
  - LoyaltyManager.tsx (6 fetch calls)
  - InventoryManager.tsx (8 fetch calls)
- Also removed redundant `headers: { 'Content-Type': 'application/json' }` since authFetch adds it

## FIX 9: H-20 — Filter sidebar navigation by permissions
- Imported `getCurrentUser` and `hasPermission` from PinLogin
- Added `permission` and `adminOnly` properties to navItems
- Filter navItems before rendering based on user role and permissions
- Admin-only items: menu, inventory, recipes, haccp, configuration, printers, webhooks, settings
- Permission-based: employees (manage_employees), cash-register/shifts (manage_cash), dashboard/reports (view_reports), orders/kitchen/tables/delivery/gift-cards/loyalty (take_orders)

## FIX 10: H-22 — Fix ReceiptDialog printing to wait for mutation
- handlePrint: now uses `await saveReceipt.mutateAsync()` before `window.print()`
- handleConfirmAndPrint: now awaits both saveReceipt and fiscalVerify before printing
- No longer uses setTimeout — mutations complete before print triggers
- On error, printing is skipped
- File: src/components/pos/ReceiptDialog.tsx

## Lint Status
- 9 pre-existing errors (none introduced by this task)
- No new errors added

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

---
Task ID: 6
Agent: Main
Task: Apply critical security and data integrity fixes (C-01, C-02, C-03, H-01, H-08, H-12, H-13, C-05+C-06, C-07, M-11)

Work Log:

## FIX 1: C-01 — Remove /api/seed from PUBLIC_ROUTES
- Removed '/api/seed' from PUBLIC_ROUTES array in auth-middleware.ts
- Added requireAuth with 'admin' permission to POST handler in seed/route.ts
- Changed function signature from `POST()` to `POST(req: Request)`

## FIX 2: C-02 — Use server-side price instead of client price
- Changed `const price = item.price` to `const price = mi.price` in orders/route.ts
- Server DB price is now the sole source of truth

## FIX 3: C-03 — Fix gift card race condition with atomic decrement
- Replaced read-then-write pattern with atomic `updateMany` + `decrement` in payments/route.ts
- Added balance check in WHERE clause to prevent over-deduction
- Added depleted status check after atomic decrement
- Throws error if balance insufficient or changed during transaction

## FIX 4: H-01 — Timing-safe PIN comparison
- Added `import crypto from 'crypto'` to auth/route.ts
- Replaced plaintext `emp.pin === data.pin` with `crypto.timingSafeEqual()`
- Maintains constant-time comparison even on length mismatch

## FIX 5: H-13 — Fix hasPermission from some() to every()
- Changed `requiredPerms.some()` to `requiredPerms.every()` in auth-middleware.ts
- Now requires ALL listed permissions, not just one

## FIX 6: C-05+C-06 — Add auth to discounts PUT/DELETE
- Added requireAuth with 'apply_discounts' permission to PUT handler
- Added requireAuth with 'admin' permission to DELETE handler
- Added check to reject client-settable `currentUses` field (returns 400)
- Changed hard delete to soft delete (set isActive: false)

## FIX 7: H-08 — Remove status from createPaymentSchema
- Removed `status: z.enum(['completed', 'refunded', 'voided']).default('completed')` from validations.ts
- In payments/route.ts, replaced `status: data.status` with `status: 'completed'` (server-side default)
- Prevents clients from creating 'refunded' or 'voided' payments

## FIX 8: M-11 — Fix receipt counter yearly reset
- Changed counter name from 'receiptNumber' to `receiptNumber-${year}` in counters.ts
- Receipt numbers now reset yearly (e.g., R-2026-000001, R-2027-000001)

## FIX 9: C-07 — Add auth to dashboard and cash-register
- Added requireAuth with 'view_reports' to dashboard GET
- Added requireAuth with 'manage_cash' to cash-register GET and POST
- Added proper try/catch blocks

## FIX 10: Add auth to additional routes
- gift-cards/route.ts: GET and POST need 'take_orders'
- loyalty/route.ts: GET and POST need 'take_orders'
- delivery/route.ts: GET and POST need 'take_orders'
- delivery/[id]/route.ts: PUT needs 'take_orders'
- print/route.ts: POST needs 'take_orders'
- furs/route.ts: GET, POST, PUT all need 'admin'
- receipts/[id]/route.ts: GET needs 'take_orders'
- employees/route.ts: GET needs 'manage_employees'

## FIX 11: H-12 — Fix receipt totalWithTip double-counting tip
- Changed `(order.totalWithTip || order.total) + (order.tip || 0)` to `order.totalWithTip || (order.total + (order.tip || 0))`
- Prevents double-counting tip when totalWithTip already includes it

## FIX 12: Add absolute session timeout
- Added `absoluteExpiry: number` to Session interface
- Set to 24 hours in createSession
- Added absoluteExpiry check in verifyToken
- Session refresh capped at absoluteExpiry (can't extend past 24h)
- Cleanup interval also checks absoluteExpiry

## Lint Status
- No new lint errors introduced
- Pre-existing errors remain in page.tsx, GlobalNotifications, ReportsView, SettingsManager
