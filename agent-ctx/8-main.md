# Task 8 — Split IntegrationManager.tsx

## Summary
Split `/src/components/pos/IntegrationManager.tsx` (666 lines) into 6 files totaling 900 lines.

## Files Created/Modified
- **Modified**: `src/components/pos/IntegrationManager.tsx` (666 → 364 lines, 45% reduction)
- **Created**: `src/components/pos/integration/constants.ts` (122 lines) — types, helpers, prop interfaces
- **Created**: `src/components/pos/integration/StatsCards.tsx` (69 lines) — 4 stats cards
- **Created**: `src/components/pos/integration/IntegrationTable.tsx` (142 lines) — filters + table
- **Created**: `src/components/pos/integration/IntegrationDialog.tsx` (168 lines) — add/edit dialog
- **Created**: `src/components/pos/integration/DeleteDialog.tsx` (35 lines) — delete confirmation

## Pattern Compliance
- ✅ All queries/mutations remain in parent component, data/callbacks passed as props
- ✅ All sub-components are `memo` wrapped with named exports
- ✅ Sub-components lazy-loaded with `next/dynamic` + `ssr: false`
- ✅ Shared types/constants in `integration/constants.ts`
- ✅ Proper TypeScript interfaces for all props
- ✅ Unused callback parameters prefixed with `_`
- ✅ Slovenian language comments maintained
- ✅ No setState inside useEffect — uses onOpenChange handler
- ✅ `htmlFor` + `id` pairs for label-input associations
- ✅ `aria-label` where appropriate

## Lint/TypeScript Status
- ESLint: 0 errors, 0 warnings
- TypeScript: 0 errors in our files (pre-existing error in ShiftManager.tsx unrelated)
