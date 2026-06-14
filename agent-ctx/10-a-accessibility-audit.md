# Task 10-a: Accessibility + Code Quality Audit

## Summary
Comprehensive audit and fix of POS system components for WCAG 2.1 AA compliance, code quality, and React Query key factory completeness.

## Files Modified
- `src/components/pos/Sidebar.tsx` — Removed duplicate nav landmark, added aria-label to kitchen badge
- `src/components/pos/kitchen/KitchenOrderItem.tsx` — Added aria-hidden to decorative icons, role="status" + aria-live to badges, role="listitem" to containers
- `src/components/pos/kitchen/KitchenOrderCard.tsx` — Added aria-labels to urgency icons, proper progressbar role, role="list" to item containers, removed stale comment
- `src/components/pos/kitchen/WaitTimer.tsx` — Added role="timer", aria-live, aria-hidden to icon
- `src/components/pos/payment/PaymentSuccessAnimation.tsx` — Added role="status", aria-live="assertive", aria-hidden to icon
- `src/components/pos/payment/CashPaymentSection.tsx` — Removed unused _change var, added aria-labels to quick cash buttons, aria-live to change amount
- `src/components/pos/payment/GiftCardSection.tsx` — Added aria-hidden to Gift icon
- `src/components/pos/payment/LoyaltySection.tsx` — Added aria-hidden to Star icon
- `src/components/pos/payment/AlternatePaymentSection.tsx` — Added aria-hidden to Ticket icon
- `src/components/pos/payment/SplitPaymentTab.tsx` — Added aria-labels and aria-pressed to split buttons, aria-hidden to Split icon
- `src/components/pos/payment/ByItemsTab.tsx` — Added aria-labels and aria-pressed to guest buttons, role="status" + aria-live to unassigned warning, aria-hidden to Users icon
- `src/components/pos/haccp/HaccpEntryCard.tsx` — Added aria-expanded to toggle button, role="alert" to warning
- `src/components/pos/haccp/HaccpEntryDialog.tsx` — Added htmlFor+id pairs to all 7 Label/Input pairs, aria-describedby on corrective action textarea, role="alert" on warning
- `src/lib/query-keys.ts` — Added 25 missing query keys across 13 domains

## Verification
- tsc: 0 errors ✅
- eslint: 0 errors ✅
- bun run lint: 0 errors ✅
