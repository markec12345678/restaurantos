# Task 9-e: Split KitchenPrepQueue.tsx and ZReportManager.tsx into sub-components

## Summary

Split two large files into smaller sub-components following the established project pattern (gift-cards, webhook, etc.).

## KitchenPrepQueue.tsx (510 → 253 lines)

### Sub-components created in `prep-queue/`:

| File | Lines | Description |
|------|-------|-------------|
| `constants.ts` | 112 | Types (OrderItem, KitchenOrder, ViewMode, KitchenStats, TimeWarning), constants (PRIORITY_CONFIG, CATEGORY_ICONS, STATUS_LABELS), helper function (getTimeWarning), props interfaces |
| `PrepQueueStats.tsx` | 68 | KPI stats bar — 4 cards showing pending/preparing/ready/avg wait time |
| `OrderCard.tsx` | 133 | Individual order card with priority badge, progress bar, items list, action button |
| `OrderColumn.tsx` | 40 | Reusable column component (pending/preparing/ready) |

### Key decisions:
- All queries/mutations remain in parent KitchenPrepQueue
- `getTimeWarning` moved to constants.ts as a pure function (was `useCallback` in parent)
- `OrderColumn` is reused 3 times with different props instead of duplicating column JSX
- `Clock` icon used as `emptyIcon` for all columns (consistent UX)

## ZReportManager.tsx (508 → 198 lines)

### Sub-components created in `zreport/`:

| File | Lines | Description |
|------|-------|-------------|
| `constants.ts` | 106 | ZReportData interface, formatCurrency helper, all props interfaces |
| `ZReportStats.tsx` | 40 | 6 KPI stat cards (total sales, net, tax, orders, guests, avg) + StatCard sub-component |
| `PaymentBreakdown.tsx` | 61 | Payment method + order type breakdown + PaymentRow sub-component |
| `VatCashSection.tsx` | 104 | VAT breakdown (22%/9.5%/0%) + Cash register reconciliation |
| `ProfitDiscountSection.tsx` | 92 | Profitability card + Discounts/tips/voids card |
| `ZReportCloseDialog.tsx` | 71 | End-of-day close dialog with cash count + notes |
| `ZReportHistory.tsx` | 54 | Recent Z-reports list with date selection |

### Key decisions:
- All queries/mutations remain in parent ZReportManager
- `formatCurrency` moved to constants.ts as shared utility
- `StatCard` and `PaymentRow` kept as internal memo'd sub-components within their respective files
- Dialog uses `onOpenChange` handler (no setState in useEffect)
- `htmlFor`+`id` pairs used in close dialog labels
- `aria-label` added to history items

## Pattern compliance:
- ✅ All queries/mutations in parent, data/callbacks as props
- ✅ All sub-components `memo` wrapped with named exports
- ✅ Sub-components lazy-loaded with `next/dynamic` + `ssr: false`
- ✅ Shared types/constants in `[component]/constants.ts`
- ✅ Proper TypeScript interfaces for all props
- ✅ Unused callback parameters prefixed with `_`
- ✅ Slovenian language comments maintained
- ✅ No setState inside useEffect
- ✅ `htmlFor`+`id` pairs for label-input associations
- ✅ `aria-label` where appropriate

## Verification:
- ESLint: 0 errors in changed files (20 pre-existing warnings in unrelated files)
- TypeScript: 0 errors across entire project
