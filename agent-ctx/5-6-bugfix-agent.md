# Task 5-6: Critical Bug Fixes — RestaurantOS POS

## Summary
Fixed 4 critical bugs in the RestaurantOS POS application.

## Changes

### 1. Hardcoded localhost:3000 URLs (6 files)
**Problem:** All internal API calls used hardcoded `http://localhost:3000`, breaking in any non-local environment.

**Fix:**
- Added `getAppUrl()` helper to `src/lib/utils.ts` that reads `NEXT_PUBLIC_APP_URL` env var with fallback to `http://localhost:3000`
- Replaced all 7 occurrences of hardcoded URLs across 5 files:
  - `src/lib/stock-deduction.ts` — `broadcastLowStockAlert()` ws-broadcast fetch
  - `src/app/api/orders/route.ts` — `broadcastWS()` and `autoPrintKitchenOrder()` fetches
  - `src/app/api/orders/[id]/route.ts` — `broadcastWS()` and `order_ready` notification fetches
  - `src/app/api/public/call-waiter/route.ts` — ws-broadcast fetch
  - `src/app/api/order-items/[id]/route.ts` — `broadcastWS()` fetch

### 2. FURS Silent Simulation Fallback (src/lib/furs.ts)
**Problem:** When FURS server was unreachable or token couldn't be obtained, `verifyInvoiceWithFURS()` silently returned `success: true` with a simulated EOR, masking real failures.

**Fix:**
- No-certificate case: Now returns `success: true` with simulation ONLY when `FURS_ALLOW_SIMULATION=true` env var is set. Otherwise returns `success: false` with `isSimulation: true` and descriptive error.
- OAuth token failure: Changed from `success: true` (simulated) to `success: false` with `isSimulation: true` and error message about unreachable server.
- Catch block (server unreachable): Changed from `success: true` (simulated EOR) to `success: false` with `isSimulation: true` and the actual error.
- `isSimulation: true` is preserved in all failure paths so callers can distinguish simulation mode from real failures.

### 3. Rate Limiter Memory Leak (src/app/api/public/order/route.ts)
**Problem:** The `orderRateLimit` Map grew unbounded — entries were never removed even after their window expired, causing a slow memory leak.

**Fix:**
- Added `cleanupRateLimitEntries()` function that iterates the Map and deletes entries where `resetAt <= now`.
- Called at the start of each rate-limit check in the POST handler, ensuring expired entries are pruned before any new entries are added.

### 4. returnStockForOrder Double-Return Bug (src/lib/stock-deduction.ts)
**Problem:** `returnStockForOrder()` didn't check the `inventoryDeducted` flag before returning stock, allowing stock to be returned multiple times for the same order.

**Fix:**
- Added a guard at the top of `returnStockForOrder()` that fetches the order and checks `inventoryDeducted`.
- If `inventoryDeducted` is `false` (stock was never deducted or already returned), the function returns `success: false` with error message "Zaloga ni bila razknjižena za to naročilo" (Stock was not deducted for this order).
