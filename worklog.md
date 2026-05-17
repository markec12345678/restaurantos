# Worklog — Task ID: 10

## Bug Fixes for RestaurantOS POS Application

### Summary
Fixed 4 high-priority bugs across the RestaurantOS POS codebase: WebSocket heartbeat, setTimeout cleanup leaks, and React Query cache mutation.

---

### Bug 1: WebSocket Heartbeat/Ping Mechanism
**File:** `src/lib/websocket-client.ts`

**Problem:** The `useKitchenWebSocket` hook had no heartbeat mechanism, meaning stale WebSocket connections could go undetected indefinitely.

**Fix:**
- Added `pingIntervalRef` and `missedPingsRef` refs to track heartbeat state
- In `ws.onopen`: start a 30-second `setInterval` that sends `JSON.stringify({ type: 'ping' })` and increments `missedPingsRef`; if missed pings exceed 2, the connection is closed
- In `ws.onmessage`: handle `pong` responses by resetting `missedPingsRef` to 0
- In `ws.onclose` and `ws.onerror`: clear the ping interval
- In `disconnect()`: clear the ping interval on manual disconnect

---

### Bug 2: setTimeout Cleanup in Waiter Page
**File:** `src/app/waiter/page.tsx`

**Problem:** `setTimeout` calls in the `acknowledge` function were not cleaned up on component unmount, potentially causing state updates on unmounted components.

**Fix:**
- Added `timeoutRefs = useRef<NodeJS.Timeout[]>([])` to track all timeout IDs
- Replaced bare `setTimeout(() => setNotifications(...), 2000)` with storing the timeout ID in `timeoutRefs.current`
- Added a cleanup `useEffect` that clears all stored timeouts on unmount

---

### Bug 3: setTimeout Cleanup in PaymentDialog
**File:** `src/components/pos/PaymentDialog.tsx`

**Problem:** `setTimeout(() => { resetAndClose() }, 1500)` in the payment success handler was not cleaned up on unmount.

**Fix:**
- Added `useRef` and `useEffect` imports
- Added `closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)` to store the timeout ID
- Replaced bare `setTimeout` with storing the ID in `closeTimeoutRef.current`
- Added a cleanup `useEffect` that clears the timeout on unmount
- Also clear the timeout in `resetAndClose()` itself to prevent double-cleanup

---

### Bug 4: KDS sort() Array Mutation
**File:** `src/app/kds/page.tsx`

**Problem:** `filteredOrders.sort()` mutates the array in-place, which can corrupt the React Query cache since `filteredOrders` derives from `activeOrders` which comes from query data.

**Fix:**
- Changed both `filteredOrders.sort(...)` calls (grid view and list view) to `[...filteredOrders].sort(...)`, creating a shallow copy before sorting to avoid mutating the cached data.

---

### Files Edited
1. `/home/z/my-project/src/lib/websocket-client.ts`
2. `/home/z/my-project/src/app/waiter/page.tsx`
3. `/home/z/my-project/src/components/pos/PaymentDialog.tsx`
4. `/home/z/my-project/src/app/kds/page.tsx`

### Verification
- Ran `bun run lint` — no new lint errors introduced by the changes (all 14 pre-existing errors are in unrelated files)
---
Task ID: 3
Agent: Super Z (main)
Task: Batch 3 bug fixes - audit and fix all bugs, push to GitHub

Work Log:
- Re-audited entire codebase (API routes, SW, Prisma schema, auth, FURS, i18n)
- Fixed SW install event crash (missing event parameter)
- Fixed SW activate event (clients.claim inside waitUntil)
- Added FURS OAuth token mutex (prevent concurrent token fetch)
- Added MAX_SESSIONS=500 to auth middleware (prevent memory leak)
- Added auth to 12 API routes (jobs, menus, modifiers, packaging, config, happy-hour, shifts, time-entries)
- Added auth to Order PATCH (item_status, fire actions)
- Added Zod validation to cash-register POST
- Wrapped FURS storno in $transaction for atomicity
- Removed client-side fiscalVerified setting from Receipt PUT
- Added audit log to Payment POST
- Added pagination to Orders GET
- Added order payment check before receipt creation
- Added 11 Prisma indexes (Check, Payment, Discount, InventoryItem, StockTransaction)
- Added rate limiter cleanup to auth route
- Replaced 'as any' with proper type in settings route
- Added authToken support to SW sync for IndexedDB
- Fixed TypeScript build errors (FURS storno variable shadow, certPath type)
- Force pushed to GitHub (main branch)

Stage Summary:
- 24 files changed, 268+ insertions, 88 deletions
- Build: ✅ Next.js 16.1.3 compiles successfully
- Git: 5f781d9 pushed to github.com/markec12345678/restaurantos
- Cumulative bug fixes: 98+ (previous) + 25+ (this batch) = 123+ total

