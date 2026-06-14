# Task 9-c: Split WebhookManager.tsx and PrinterManager.tsx

## Summary
Split two large component files into smaller sub-components following the established pattern.

## Files Created

### WebhookManager (592 → 305 parent, 821 total across 6 files)
- `src/components/pos/webhook/constants.ts` (142 lines) - types, constants, helpers, props interfaces
- `src/components/pos/webhook/StatsCards.tsx` (69 lines) - 4 stats cards
- `src/components/pos/webhook/WebhookTable.tsx` (148 lines) - filters + table
- `src/components/pos/webhook/WebhookDialog.tsx` (122 lines) - create/edit dialog
- `src/components/pos/webhook/DeleteDialog.tsx` (35 lines) - delete confirmation

### PrinterManager (574 → 270 parent, 757 total across 5 files)
- `src/components/pos/printer/constants.ts` (115 lines) - types, constants, helpers, props interfaces
- `src/components/pos/printer/StatsCards.tsx` (41 lines) - 4 stats cards
- `src/components/pos/printer/PrinterGrid.tsx` (178 lines) - search + printer card grid
- `src/components/pos/printer/PrinterDialog.tsx` (153 lines) - create/edit dialog

## Pattern Compliance
- All sub-components: memo-wrapped with named exports
- Dynamic imports: next/dynamic + ssr: false
- Shared types/constants in constants.ts files
- Proper TypeScript interfaces for all props
- Unused callback parameters prefixed with _
- Slovenian comments preserved
- htmlFor + id pairs for label-input associations
- aria-label attributes maintained
- onOpenChange handler pattern (no setState inside useEffect)

## Lint/TypeScript Status
- ESLint: 0 errors, 0 warnings in our files
- TypeScript: 0 errors in our files
- Pre-existing errors in location/constants.ts and floorplan/constants.ts unrelated
