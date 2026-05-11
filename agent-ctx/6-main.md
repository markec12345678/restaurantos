# Task 6 - Security & Data Integrity Fixes

## Summary
Applied 12 critical security and data integrity fixes to the RestaurantOS POS system.

## Files Modified

### Core Auth & Middleware
- `src/lib/auth-middleware.ts` — Removed /api/seed from PUBLIC_ROUTES; added absoluteExpiry to Session; changed hasPermission from some() to every(); session refresh capped at absoluteExpiry; cleanup interval checks absoluteExpiry
- `src/lib/validations.ts` — Removed status field from createPaymentSchema (prevents client from setting payment status)
- `src/lib/counters.ts` — Receipt counter now includes year (receiptNumber-YYYY) for yearly reset

### API Routes - Auth & Security
- `src/app/api/seed/route.ts` — Added requireAuth with admin permission; changed signature to POST(req: Request)
- `src/app/api/auth/route.ts` — Replaced plaintext PIN comparison with crypto.timingSafeEqual
- `src/app/api/orders/route.ts` — Changed price source from client (item.price) to server DB (mi.price)
- `src/app/api/payments/route.ts` — Atomic gift card decrement; server-side status default 'completed'
- `src/app/api/discounts/[id]/route.ts` — Added auth to PUT/DELETE; blocked currentUses from client; soft delete
- `src/app/api/dashboard/route.ts` — Added requireAuth with view_reports
- `src/app/api/cash-register/route.ts` — Added requireAuth with manage_cash to GET/POST
- `src/app/api/gift-cards/route.ts` — Added requireAuth with take_orders to GET/POST
- `src/app/api/loyalty/route.ts` — Added requireAuth with take_orders to GET/POST
- `src/app/api/delivery/route.ts` — Added requireAuth with take_orders to GET/POST
- `src/app/api/delivery/[id]/route.ts` — Added requireAuth with take_orders to PUT
- `src/app/api/print/route.ts` — Added requireAuth with take_orders to POST
- `src/app/api/furs/route.ts` — Added requireAuth with admin to GET/POST/PUT
- `src/app/api/receipts/[id]/route.ts` — Added requireAuth with take_orders to GET; fixed totalWithTip double-counting
- `src/app/api/employees/route.ts` — Added requireAuth with manage_employees to GET

## Lint Status
- No new lint errors introduced
- Pre-existing errors: page.tsx, GlobalNotifications, ReportsView, SettingsManager, generate-audit-report.js
