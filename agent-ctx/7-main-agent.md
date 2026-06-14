# Task 7: Split ShiftManager.tsx into sub-components

## Summary
Successfully refactored ShiftManager.tsx (667 lines) into 6 files (1032 lines total), following the established pattern from ReservationManager, StaffScheduler, RecipeManager, and IntegrationManager refactoring.

## Files Created
1. `src/components/pos/shift/constants.ts` (149 lines) — Types, constants, helpers, props interfaces
2. `src/components/pos/shift/ShiftsTab.tsx` (163 lines) — Shifts tab with ShiftsTable + ShiftActions inner memo components
3. `src/components/pos/shift/TimeTab.tsx` (193 lines) — Time tab with ActiveEntriesTable + CompletedEntriesTable inner memo components
4. `src/components/pos/shift/ShiftDialog.tsx` (112 lines) — Create/edit shift dialog
5. `src/components/pos/shift/DeleteShiftDialog.tsx` (35 lines) — Delete confirmation dialog

## File Modified
- `src/components/pos/ShiftManager.tsx` — Reduced from 667 → 380 lines (43% reduction)

## Pattern Compliance
- All queries/mutations remain in parent component ✓
- All sub-components are memo-wrapped with named exports ✓
- Sub-components lazy-loaded with next/dynamic + ssr: false ✓
- Shared types/constants go to shift/constants.ts ✓
- Proper TypeScript interfaces for all props ✓
- Unused callback parameters prefixed with _ ✓
- Slovenian language comments maintained ✓
- No setState inside useEffect — used onOpenChange handlers ✓
- htmlFor + id pairs for label-input associations ✓
- aria-label attributes maintained ✓

## Checks
- ESLint: 0 errors, 0 warnings ✓
- TypeScript: 0 errors in our files (pre-existing errors in Dashboard.tsx are unrelated)
