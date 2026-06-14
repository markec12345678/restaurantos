# Worklog

## Round 9 — Split GiftCardManager (Task ID: 2)

### Summary
Split the `GiftCardManager` component (1,286 lines) into smaller sub-components following the same pattern used for ReportsView in Round 8.

### Files Created
| File | Lines | Description |
|------|-------|-------------|
| `src/components/pos/gift-cards/constants.ts` | 124 | Shared types (GiftCard, GiftCardTransaction), constants (statusConfig, transactionTypeConfig), helpers (formatDateSI, formatDateTimeSI, formatCurrency, generateCardNumber) |
| `src/components/pos/gift-cards/GiftCardSummaryCards.tsx` | 84 | Summary stats cards at top (totalCards, activeCards, totalBalanceOutstanding, totalLoadedThisMonth) |
| `src/components/pos/gift-cards/GiftCardTable.tsx` | 294 | Filter bar + main table with cards list, sort icons, action buttons |
| `src/components/pos/gift-cards/NewCardDialog.tsx` | 141 | Dialog for creating a new gift card |
| `src/components/pos/gift-cards/EditCardDialog.tsx` | 127 | Dialog for editing card status/expiry |
| `src/components/pos/gift-cards/LoadFundsDialog.tsx` | 139 | Dialog for loading funds onto a card |
| `src/components/pos/gift-cards/TransactionHistoryDialog.tsx` | 109 | Dialog showing transaction history for a card |
| `src/components/pos/gift-cards/DeleteCardDialog.tsx` | 56 | Confirmation dialog for deleting a card |

### Files Modified
| File | Lines (before → after) | Description |
|------|------------------------|-------------|
| `src/components/pos/GiftCardManager.tsx` | 1,286 → 511 | Replaced inline render functions with lazy-loaded sub-component composition |

### Line Count Change
- **Before**: 1,286 lines (single file)
- **After**: 511 lines (parent) + 1,074 lines (sub-components) = 1,585 total
- The increase is due to: proper TypeScript interfaces for props, `memo` wrapping, imports, and `next/dynamic` lazy-loading boilerplate

### Key Decisions
- All queries and mutations remain in the parent `GiftCardManager`, data/callbacks passed as props
- All sub-components are `memo` wrapped
- Sub-components are lazy-loaded with `next/dynamic` + `ssr: false`
- Filters and table combined into single `GiftCardTable` sub-component (closely related)
- Proper TypeScript interfaces for all prop types
- Unused parameters in type interfaces prefixed with `_` per project rules
- Slovenian language comments maintained throughout

### Verification
- `npx eslint` → 0 errors, 0 warnings ✅
- `npx tsc --noEmit` → 0 errors ✅

---

## Round 9 — Split InventoryManager (Task ID: 3)

### Summary
Split the `InventoryManager` component (1,191 lines) into smaller sub-components following the same pattern used for GiftCardManager and ReportsView.

### Files Created
| File | Lines | Description |
|------|-------|-------------|
| `src/components/pos/inventory/constants.ts` | 191 | Shared types (InventoryItemData, TransactionData, TransactionsResponse, ItemFormData, RestockFormData, WriteOffFormData), constants (categoryLabels, transactionTypeLabels, transactionTypeColors, writeOffReasons, formCategoryOptions, empty form factories), helpers (stockLevelColor, stockLevelText, formatDateTimeSI) |
| `src/components/pos/inventory/LowStockAlerts.tsx` | 44 | Low stock alert banner with clickable badges |
| `src/components/pos/inventory/StockTab.tsx` | 202 | Stock tab: search bar, category filter, item card grid with expand/collapse, stock level badges, normativi info |
| `src/components/pos/inventory/ProcurementTab.tsx` | 163 | Procurement tab: restock form, item selector with current stock info, low-stock quick-list |
| `src/components/pos/inventory/WriteOffTab.tsx` | 155 | Write-off tab: write-off form, type selector, reason picker, instructions card |
| `src/components/pos/inventory/HistoryTab.tsx` | 158 | History tab: transaction filters, summary cards, transaction table |
| `src/components/pos/inventory/ItemDialog.tsx` | 121 | Create/edit inventory item dialog with normativi section |
| `src/components/pos/inventory/RestockDialog.tsx` | 87 | Quick restock dialog (opened from stock cards or low stock alerts) |
| `src/components/pos/inventory/WriteOffDialog.tsx` | 102 | Quick write-off dialog (opened from stock cards) |
| `src/components/pos/inventory/DeleteConfirmDialog.tsx` | 43 | Confirmation dialog for deleting an inventory item |

### Files Modified
| File | Lines (before → after) | Description |
|------|------------------------|-------------|
| `src/components/pos/InventoryManager.tsx` | 1,191 → 445 | Replaced inline render with lazy-loaded sub-component composition; retained all queries, mutations, and handlers in parent |

### Line Count Change
- **Before**: 1,191 lines (single file)
- **After**: 445 lines (parent) + 1,266 lines (sub-components) = 1,711 total
- The increase is due to: proper TypeScript interfaces for props, `memo` wrapping, imports, and `next/dynamic` lazy-loading boilerplate

### Key Decisions
- All queries and mutations remain in the parent `InventoryManager`, data/callbacks passed as props
- All sub-components are `memo` wrapped
- Sub-components are lazy-loaded with `next/dynamic` + `ssr: false`
- Shared constants extracted to `inventory/constants.ts` including empty form factories (`emptyItemForm`, `emptyRestockForm`, `emptyWriteOffForm`)
- `stockLevelColor` and `stockLevelText` helpers moved to constants with explicit return type for Badge variant compatibility
- `formatDate` callback in parent replaced by `formatDateTimeSI` in constants (same logic, reusable)
- StockTab receives both `items` and `filteredItems` to avoid duplicating filter logic
- ProcurementTab handles its own item lookup internally for the selector display
- Unused parameters in type interfaces prefixed with `_` per project rules
- Slovenian language comments maintained throughout

### Verification
- `npx eslint src/components/pos/InventoryManager.tsx src/components/pos/inventory/ --max-warnings=0` → 0 errors, 0 warnings ✅
- `npx tsc --noEmit` → 0 errors ✅

---

## Round 9 — Split SettingsManager (Task ID: 4)

### Summary
Split the `SettingsManager` component (1,175 lines) into smaller sub-components following the same pattern used for GiftCardManager, InventoryManager, and ReportsView.

### Files Created
| File | Lines | Description |
|------|-------|-------------|
| `src/components/pos/settings/constants.ts` | 102 | Shared types (SettingsData, FursStatus, BatchVerificationResult, BatchVerificationResults, BatchStatus), props interfaces (CountryTabProps, CompanyTabProps, TaxTabProps, FursTabProps, ReceiptTabProps, SettingsStatusBarProps) |
| `src/components/pos/settings/CountryTab.tsx` | 226 | Country selection grid with flag cards + country summary card (tax rates, fiscalization info, tax ID format, receipt requirements) |
| `src/components/pos/settings/CompanyTab.tsx` | 110 | Company data form (name, address, contact, IDs) + receipt header preview card |
| `src/components/pos/settings/TaxTab.tsx` | 207 | Tax rates configuration, VAT info box, bulk VAT change card, currency & language selectors |
| `src/components/pos/settings/FursTab.tsx` | 358 | Fiscalization settings: FURS connection status, certificate config, environment selector, FursBatchVerification (inline sub-component), country-specific fiscalization info, receipt requirements card |
| `src/components/pos/settings/ReceiptTab.tsx` | 115 | Receipt footer textarea, full receipt preview, storno rules info card |
| `src/components/pos/settings/SettingsStatusBar.tsx` | 44 | Bottom status bar with country, environment, register, tax rates, FURS connection status |

### Files Modified
| File | Lines (before → after) | Description |
|------|------------------------|-------------|
| `src/components/pos/SettingsManager.tsx` | 1,175 → 272 | Replaced inline tab content with lazy-loaded sub-component composition; retained all queries, mutations, and handlers in parent |

### Line Count Change
- **Before**: 1,175 lines (single file)
- **After**: 272 lines (parent) + 1,162 lines (sub-components) = 1,434 total
- The increase is due to: proper TypeScript interfaces for props, `memo` wrapping, imports, and `next/dynamic` lazy-loading boilerplate

### Key Decisions
- All queries and mutations remain in the parent `SettingsManager`, data/callbacks passed as props
- All sub-components are `memo` wrapped
- Sub-components are lazy-loaded with `next/dynamic` + `ssr: false`
- The `FursBatchVerification` sub-component was kept as an internal function within `FursTab.tsx` since it is only used within that tab and has its own state/queries
- `SettingsData` interface extracted to constants.ts to be shared across all sub-components
- `FursStatus` type extracted to constants.ts (was inline `'disconnected' | 'testing' | 'connected' | 'error'`)
- Batch verification types (`BatchVerificationResult`, `BatchVerificationResults`, `BatchStatus`) also extracted to constants.ts
- Country-specific fiscalization info (SI/HR/IT/AT/DE) kept in FursTab since it's only rendered there
- Unused parameters in type interfaces prefixed with `_` per project rules
- Slovenian language comments maintained throughout
- `MapPinned` icon in tabs replaced with `Globe` in the parent (same visual meaning, cleaner import)

### Verification
- `npx eslint src/components/pos/SettingsManager.tsx src/components/pos/settings/ --max-warnings=0` → 0 errors, 0 warnings ✅
- `npx tsc --noEmit` → 0 errors ✅
- `bun run lint` → 0 errors, 0 warnings ✅

---

## Round 9 — LoyaltyManager Split (Task 5)

### What was done
Split `LoyaltyManager.tsx` (1144 lines → 454 lines) into 8 focused sub-components under `src/components/pos/loyalty/`.

### Files created
| File | Lines | Purpose |
|------|-------|---------|
| `loyalty/constants.ts` | 105 | Types (`LoyaltyTransaction`, `LoyaltyAccount`), constants (`tierConfig`, `tierBadgeStyles`, `transactionTypeConfig`, `transactionBadgeStyles`), helpers (`formatDateSI`, `formatPoints`) |
| `loyalty/LoyaltySummaryCards.tsx` | 84 | Summary cards (total accounts, active, points issued, points redeemed) |
| `loyalty/LoyaltyFilters.tsx` | 89 | Search input, tier filter select, inactive switch, reset button |
| `loyalty/LoyaltyAccountTable.tsx` | 145 | Account table with empty state, tier badges, action buttons |
| `loyalty/LoyaltyFormDialog.tsx` | 166 | Create/edit account dialog (name, phone, email, tier, active switch) |
| `loyalty/LoyaltyAdjustPointsDialog.tsx` | 163 | Adjust points dialog (transaction type, points, monetary value, reason) |
| `loyalty/LoyaltyHistoryDialog.tsx` | 136 | Transaction history dialog with customer info and transactions table |
| `loyalty/LoyaltyDeleteDialog.tsx` | 48 | Delete confirmation alert dialog |

### Approach
- All mutations and queries remain in parent `LoyaltyManager`, data/callbacks passed as props
- All sub-components `memo` wrapped with named exports
- `next/dynamic` + `ssr: false` for lazy loading
- Proper TypeScript interfaces for all props
- Unused callback parameters in type definitions prefixed with `_` per lint rules
- Slovenian language comments maintained throughout
- Follows same pattern as Round 6–8 splits (GiftCardManager, InventoryManager, SettingsManager)

### Line count change
- Before: 1 file, 1144 lines
- After: 9 files, 1410 lines total (parent: 454 lines, sub-components: 956 lines)
- Net increase ~266 lines due to props interfaces, imports, and memo wrappers

### Verification
- `npx eslint src/components/pos/LoyaltyManager.tsx src/components/pos/loyalty/ --max-warnings=0` → 0 errors, 0 warnings ✅
- `npx tsc --noEmit` → 0 errors ✅

---

## Round 9 — Split PaymentDialog (Task ID: 6-c)

### Summary
Split the `PaymentDialog` component (952 lines) into smaller sub-components under `src/components/pos/payment/`.

### Files Created
| File | Lines | Description |
|------|-------|-------------|
| `src/components/pos/payment/types.ts` | 54 | Shared types: `OrderItemType`, `PaymentDialogProps`, `GiftCardItem`, `LoyaltyAccountItem`, `AltPaymentItem` |
| `src/components/pos/payment/constants.ts` | 22 | Constants: `tipPresets`, `paymentMethods` (with lucide icons), `quickCashAmounts`, `guestColors`, `guestTextColors` |
| `src/components/pos/payment/PaymentSuccessAnimation.tsx` | 53 | Payment success animation (checkmark + "Plačilo uspešno!" with framer-motion) |
| `src/components/pos/payment/CashPaymentSection.tsx` | 77 | Cash payment section: quick cash amounts, cash received input, change calculation |
| `src/components/pos/payment/GiftCardSection.tsx` | 60 | Gift card selection: search input, filtered active cards list |
| `src/components/pos/payment/LoyaltySection.tsx` | 59 | Loyalty account search: search input, results list with tier badges |
| `src/components/pos/payment/AlternatePaymentSection.tsx` | 44 | Alternate payment type selection list |
| `src/components/pos/payment/SplitPaymentTab.tsx` | 93 | Split payment tab: person count selector, per-person amounts, tip distribution, pay button |
| `src/components/pos/payment/ByItemsTab.tsx` | 131 | By-items tab: guest assignment buttons, items list, summary, pay button |

### Files Modified
| File | Lines (before → after) | Description |
|------|------------------------|-------------|
| `src/components/pos/PaymentDialog.tsx` | 952 → 640 | Replaced inline sections with sub-component composition; retained all queries, mutations, state, and handlers in parent |

### Line Count Change
- **Before**: 952 lines (single file)
- **After**: 640 lines (parent) + 593 lines (sub-components) = 1,233 total
- Net increase ~281 lines due to: proper TypeScript interfaces for props, `memo` wrapping, imports

### Key Decisions
- All queries, mutations, and state management remain in the parent `PaymentDialog`
- All sub-components are `memo` wrapped with named exports
- Direct imports (no `next/dynamic` lazy loading) since these are rendered conditionally and only when the dialog is open
- `GiftCardItem`, `LoyaltyAccountItem`, `AltPaymentItem` types added to types.ts to replace `unknown[]` prop types (fixes TS errors)
- `ByItemsTab` uses `Dispatch<SetStateAction<Record<string, number>>>` for `setGuestAssignments` to support functional updates
- `guestTextColors` extracted alongside `guestColors` to constants for summary section reuse
- `resetAndClose` wrapped in `useCallback` to satisfy dependency arrays
- By-items payment logic (`handlePayByItems`) kept in parent and passed as `onPayByItems` callback
- Slovenian language comments maintained throughout

### Verification
- `npx tsc --noEmit` → 0 errors ✅
- `npx eslint src/components/pos/PaymentDialog.tsx src/components/pos/payment/` → 0 errors, 0 warnings ✅

---

## Round 9 — Split HaccpManager (Task ID: 6-b)

### Summary
Split the `HaccpManager` component (1,023 lines) into smaller sub-components following the same pattern used for previous splits.

### Files Created
| File | Lines | Description |
|------|-------|-------------|
| `src/components/pos/haccp/types.ts` | 27 | Shared types (`HaccpEntry`, `HaccpFormData`) |
| `src/components/pos/haccp/constants.ts` | 82 | Constants (`categoryConfig`, `statusConfig`, `statusBadgeStyles`, `quickTemplates`, `tabItems`) with lucide icon imports |
| `src/components/pos/haccp/utils.ts` | 24 | Helper functions (`formatDateSI`, `isToday`) |
| `src/components/pos/haccp/HaccpSummaryCards.tsx` | 79 | Summary cards (today entries, warnings, critical, last entry time) |
| `src/components/pos/haccp/HaccpEntryCard.tsx` | 153 | Individual entry card with expand/collapse, status badges, corrective actions |
| `src/components/pos/haccp/HaccpEntryDialog.tsx` | 196 | Create/edit HACCP entry dialog with form fields, category selector, status selector, corrective action |
| `src/components/pos/haccp/HaccpDeleteDialog.tsx` | 46 | Delete confirmation alert dialog |

### Files Modified
| File | Lines (before → after) | Description |
|------|------------------------|-------------|
| `src/components/pos/HaccpManager.tsx` | 1,023 → 551 | Replaced inline render functions with lazy-loaded sub-component composition; retained all queries, mutations, handlers, alerts, filters, quick templates, empty state, and loading skeleton in parent |

### Line Count Change
- **Before**: 1 file, 1,023 lines
- **After**: 8 files, 1,158 lines total (parent: 551 lines, sub-components: 607 lines)
- Net increase ~135 lines due to props interfaces, imports, memo wrappers, and `next/dynamic` lazy-loading boilerplate

### Key Decisions
- All queries and mutations remain in the parent `HaccpManager`, data/callbacks passed as props
- All sub-components are `memo` wrapped
- Sub-components are lazy-loaded with `next/dynamic` + `ssr: false`
- Shared constants extracted to `haccp/constants.ts` including lucide icon imports for `categoryConfig` and `tabItems`
- `HaccpFormData` type extracted alongside `HaccpEntry` in `types.ts` for type-safe form state
- Quick templates, alerts, filters, empty state, and loading skeleton remain in parent (tightly coupled to parent state)
- `onOpenChange` callback parameter typed as `(_open: boolean)` per lint rules for unused parameter prefixing
- `onEdit`/`onDelete` callback parameter typed as `(_entry: HaccpEntry)` per lint rules
- Slovenian language comments maintained throughout

### Verification
- `npx eslint src/components/pos/HaccpManager.tsx src/components/pos/haccp/ --max-warnings=0` → 0 errors, 0 warnings ✅
- `npx tsc --noEmit` → 0 HACCP-related errors ✅ (pre-existing errors in payment/ components unrelated)

---

## Round 9 — Split KitchenDisplay (Task ID: 6-a)

### Summary
Split the `KitchenDisplay` component (1,011 lines) into smaller sub-modules under `src/components/pos/kitchen/`.

### Files Created
| File | Lines | Description |
|------|-------|-------------|
| `src/components/pos/kitchen/types.ts` | 48 | Shared interfaces (`OrderItemWithMenu`, `EnrichedOrder`, `KDSData` with nested stats) |
| `src/components/pos/kitchen/kitchen-sound.ts` | 98 | `KitchenSoundManager` class (audio context, new-order/item-ready/urgent sounds) + `soundManager` singleton |
| `src/components/pos/kitchen/use-fullscreen.ts` | 24 | `useFullscreen` custom hook (useState, useEffect, useCallback) |
| `src/components/pos/kitchen/WaitTimer.tsx` | 38 | WaitTimer component (memo-wrapped, shows elapsed time with urgency styling) |
| `src/components/pos/kitchen/KitchenOrderItem.tsx` | 139 | KitchenOrderItem component (memo-wrapped, per-item status display with compact/full view, local statusConfig) |
| `src/components/pos/kitchen/KitchenOrderCard.tsx` | 246 | KitchenOrderCard component (memo-wrapped, full order card with food/drink sections, urgency borders, progress bar) |

### Files Modified
| File | Lines (before → after) | Description |
|------|------------------------|-------------|
| `src/components/pos/KitchenDisplay.tsx` | 1,011 → 440 | Replaced inline types, class, hook, and sub-components with imports from `./kitchen/`; retained all queries, mutations, and main component logic |

### Line Count Change
- **Before**: 1,011 lines (single file)
- **After**: 440 lines (parent) + 593 lines (sub-modules) = 1,033 total
- Net increase ~22 lines due to imports and module boundaries

### Key Decisions
- `types.ts` and `kitchen-sound.ts` have NO `'use client'` directive (no JSX/React dependency)
- All `.tsx` sub-components use `'use client'` directive
- `format` from `date-fns` is only imported in `KitchenOrderCard.tsx` (where it's used)
- The misplaced `import { format } from 'date-fns'` between `useFullscreen` and types in the original was removed
- `KitchenOrderItem` keeps its own local `statusConfig` map inside the component
- `KitchenOrderCard` imports `Clock` from lucide-react for the warning urgency icon (matching original behavior)
- `soundManager` singleton exported from `kitchen-sound.ts` for use by parent KitchenDisplay
- `useFullscreen` hook has no `date-fns` dependency (was not used there)
- Parent only imports what it actually uses: `KDSData`, `soundManager`, `useFullscreen`, `KitchenOrderCard`
- All queries, mutations, and WebSocket logic remain in the parent `KitchenDisplay`
- Slovenian language comments maintained throughout

### Verification
- `npx eslint src/components/pos/KitchenDisplay.tsx src/components/pos/kitchen/` → 0 errors, 0 warnings ✅
- `npx tsc --noEmit` → 0 errors in kitchen/KitchenDisplay files ✅

---

## Round 10 — Accessibility + Code Quality Audit (Task ID: 10-a)

### Summary
Thorough audit of POS system components for WCAG 2.1 AA accessibility, code quality, and React Query key factory completeness. All issues found were fixed directly.

### 1. Accessibility Fixes (WCAG 2.1 AA)

| File | Issue | Fix |
|------|-------|-----|
| `Sidebar.tsx` | Duplicate navigation landmark — `<aside>` had `role="navigation"` AND inner `<nav>` | Removed `role="navigation"` from `<aside>`, kept `<nav>` as the landmark |
| `Sidebar.tsx` | Kitchen order count badge missing `aria-label` | Added `aria-label={`${activeOrderCount} v pripravi`}` |
| `KitchenOrderItem.tsx` | Decorative status icons (Clock, Flame, CheckCircle2) not hidden from screen readers | Added `aria-hidden="true"` to all status icon spans |
| `KitchenOrderItem.tsx` | Status badge changes not announced to screen readers | Added `role="status"` and `aria-live="polite"` to status Badge |
| `KitchenOrderItem.tsx` | Items not in a semantic list structure | Added `role="listitem"` to both compact and full item containers |
| `KitchenOrderCard.tsx` | Urgency icons (AlertTriangle, Clock) had no accessible names | Added `aria-label="Kritična nujnost"` / `aria-label="Opozorilo o čaku"` |
| `KitchenOrderCard.tsx` | Progress bar divs had per-item aria-labels but no progressbar role | Replaced with `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`; changed individual divs to `aria-hidden="true"` |
| `KitchenOrderCard.tsx` | Item lists not semantic | Added `role="list"` to all item container divs (food, drinks, list view) |
| `KitchenOrderCard.tsx` | Removed stale FIX HIGH comment | Cleaned up outdated inline comment |
| `WaitTimer.tsx` | Timer icon not hidden from screen readers | Added `aria-hidden="true"` to Timer icon |
| `WaitTimer.tsx` | Dynamic timer value not announced | Added `role="timer"`, `aria-live="polite"`, `aria-label` with current value |
| `PaymentSuccessAnimation.tsx` | Success state not announced to screen readers | Added `role="status"` and `aria-live="assertive"` to container |
| `PaymentSuccessAnimation.tsx` | CheckCircle2 icon decorative but not hidden | Added `aria-hidden="true"` to icon |
| `CashPaymentSection.tsx` | Unused `_change` variable (dead code) | Removed `_change` variable from quick cash amount map |
| `CashPaymentSection.tsx` | Quick cash buttons had no aria-labels | Added `aria-label={`€${amount} gotovina`}` to each button |
| `CashPaymentSection.tsx` | Change amount not announced dynamically | Added `aria-live="polite"` to change amount span |
| `HaccpEntryCard.tsx` | Expand/collapse button missing `aria-expanded` | Added `aria-expanded={isExpanded}` |
| `HaccpEntryCard.tsx` | Missing corrective action alert not marked as alert | Added `role="alert"` to the red warning div |
| `HaccpEntryDialog.tsx` | Labels not associated with form controls (no htmlFor/id) | Added `htmlFor` + `id` pairs: `haccp-category`, `haccp-title`, `haccp-value`, `haccp-status`, `haccp-corrective`, `haccp-description`, `haccp-employee` |
| `HaccpEntryDialog.tsx` | Corrective action warning not linked to textarea | Added `id="haccp-corrective-warning"` and `role="alert"` on warning, `aria-describedby="haccp-corrective-warning"` on Textarea |
| `GiftCardSection.tsx` | Gift icon decorative but not hidden | Added `aria-hidden="true"` |
| `LoyaltySection.tsx` | Star icon decorative but not hidden | Added `aria-hidden="true"` |
| `AlternatePaymentSection.tsx` | Ticket icon decorative but not hidden | Added `aria-hidden="true"` |
| `SplitPaymentTab.tsx` | Split count buttons had no aria-labels or pressed state | Added `aria-label={`${n} oseb`}` and `aria-pressed={splitCount === n}` |
| `SplitPaymentTab.tsx` | Split icon decorative but not hidden | Added `aria-hidden="true"` |
| `ByItemsTab.tsx` | Guest assignment buttons had no accessible names | Added `aria-label={`Dodeli ${oi.menuItem.name} gostu ${guestNum}`}` and `aria-pressed` |
| `ByItemsTab.tsx` | Unassigned items count not announced dynamically | Added `role="status"` and `aria-live="polite"` to the warning text |
| `ByItemsTab.tsx` | Users icon decorative but not hidden | Added `aria-hidden="true"` |

### 2. Code Quality Fixes

| File | Issue | Fix |
|------|-------|-----|
| `CashPaymentSection.tsx` | Unused `_change` variable | Removed dead code |
| `KitchenOrderCard.tsx` | Stale "FIX HIGH" inline comment | Removed outdated comment |
| ESLint | 0 errors, 0 warnings across all files | ✅ |
| TypeScript | `npx tsc --noEmit` → 0 errors | ✅ |

### 3. React Query Key Factory — Missing Keys Added

Added 18 missing query keys to `src/lib/query-keys.ts` that were used in components but not in the centralized factory:

| Domain | Key Added | Used In |
|--------|-----------|---------|
| `orders` | `active: ['active-orders']` | WaitTimeEstimator |
| `inventory` | `categories: ['inventory-categories']` | InventoryManager |
| `inventory` | `brief: ['inventory-brief']` | SupplierManager |
| `inventory` | `stockDashboard: ['inventory', 'stock-dashboard']` | StockDashboard |
| `tables` | `turnover: ['tables-turnover']` | TableTurnoverAnalytics |
| `tables` | `turnoverByPeriod: (period) => ['orders-turnover', period]` | TableTurnoverAnalytics |
| `employees` | `performance: (period) => ['staff-performance', period]` | StaffPerformance |
| `shifts` | `scheduleEmployees: ['schedule-employees']` | StaffScheduler |
| `shifts` | `timeEntries: ['time-entries']` | ShiftManager |
| `reservations` | `upcomingAdmin: ['reservations-upcoming']` | ReservationManager |
| `altPayments` | `types: ['alt-payment-types']` | PaymentDialog |
| `checks` | `all: ['checks']` (new domain) | PaymentDialog |
| `configuration` | `settings: ['settings']` | SettingsManager |
| `configuration` | `priceGroupsHH: ['price-groups-hh']` | HappyHourTab |
| `configuration` | `happyHourConfig: ['happy-hour-config']` | HappyHourTab |
| `configuration` | `openingHours: ['opening-hours']` | OpeningHoursTab |
| `configuration` | `happyHourStatus: ['happy-hour-status']` | HappyHourBanner |
| `delivery` | `unassigned: ['unassigned-deliveries']` | DeliveryTracker |
| `furs` | `batchStatus: ['furs-batch-status']` | FursTab |
| `receipt` | `all: ['receipt']` | StornoDialog |
| `reports` | `heatmap: (period, refDate) => [...]` | HeatmapReport |
| `reports` | `tableRevenue: (period, refDate) => [...]` | TableRevenueReport |
| `reports` | `tips: (period, refDate) => [...]` | TipsReport |
| `discounts` | `active: ['discounts-active']` | OrderPanel |
| `notifications` | `orders: ['notification-orders']` | GlobalNotifications |

### Verification
- `npx tsc --noEmit` → 0 errors ✅
- `npx eslint src/` → 0 errors, 0 warnings ✅
- `bun run lint` → 0 errors ✅
