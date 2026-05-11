# Task 2 - WebSocket, Kiosk Mode, Printer API, PWA

## Agent: Main
## Status: COMPLETED

## Summary

Implemented all 5 major features for the Slovenian restaurant POS system:

### 1. WebSocket Server (Real-Time KDS)
- Created `server.js` - custom Next.js server with `ws` WebSocket on `/ws`
- Created `src/app/api/ws-broadcast/route.ts` - API for broadcasting WS events
- Created `src/lib/websocket-client.ts` - `useKitchenWebSocket()` hook with auto-reconnect
- Updated 3 API routes to broadcast WS events (orders, order-items, orders/[id])
- Updated KitchenDisplay.tsx to use WebSocket with 5s polling fallback

### 2. Kiosk Mode
- Added `kioskMode`, `kioskAllowedModules` to Zustand store
- Created `KioskBar.tsx` - compact top bar with PIN-protected exit
- Updated `page.tsx` - shows KioskBar instead of Sidebar in kiosk mode
- Added "Kiosk način" button to Sidebar

### 3. Kitchen Printer API (ESC/POS)
- Created `src/lib/escpos.ts` - ESC/POS command builder (Epson + Star)
- Code Page 852 for Slovenian characters
- Created `src/app/api/print/route.ts` - TCP/IP printing to network printers
- Auto-print on new orders

### 4. PWA Improvements
- Updated manifest.json (landscape, shortcuts)
- Updated layout.tsx (installable meta, overscroll-behavior)
- Updated sw.js (background sync, offline order queue, aggressive caching)

### 5. Package.json Scripts
- Added `dev:ws` and `start:ws` scripts

## Files Created
- `/home/z/my-project/server.js`
- `/home/z/my-project/src/app/api/ws-broadcast/route.ts`
- `/home/z/my-project/src/app/api/print/route.ts`
- `/home/z/my-project/src/lib/websocket-client.ts`
- `/home/z/my-project/src/lib/escpos.ts`
- `/home/z/my-project/src/components/pos/KioskBar.tsx`

## Files Modified
- `/home/z/my-project/src/lib/store.ts`
- `/home/z/my-project/src/app/page.tsx`
- `/home/z/my-project/src/components/pos/Sidebar.tsx`
- `/home/z/my-project/src/components/pos/KitchenDisplay.tsx`
- `/home/z/my-project/src/app/api/orders/route.ts`
- `/home/z/my-project/src/app/api/order-items/[id]/route.ts`
- `/home/z/my-project/src/app/api/orders/[id]/route.ts`
- `/home/z/my-project/public/manifest.json`
- `/home/z/my-project/src/app/layout.tsx`
- `/home/z/my-project/public/sw.js`
- `/home/z/my-project/package.json`
- `/home/z/my-project/eslint.config.mjs`
- `/home/z/my-project/worklog.md`

## Build: ✅ PASSED
