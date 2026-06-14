# Task 9-d: Component Split Work Record

## Task
Split TableMap.tsx (535 lines) and GuestManager.tsx (514 lines) into smaller sub-components following the established pattern.

## Changes Made

### TableMap.tsx Split (535 → 290 lines parent + 6 sub-components)

| File | Lines |
|------|-------|
| `TableMap.tsx` (parent) | 290 |
| `tablemap/constants.ts` | 91 |
| `tablemap/TableSummaryStats.tsx` | 43 |
| `tablemap/TableLegend.tsx` | 19 |
| `tablemap/TableGrid.tsx` | 105 |
| `tablemap/TableOrdersDialog.tsx` | 120 |
| `tablemap/TableFormDialog.tsx` | 95 |
| `tablemap/TableDeleteDialog.tsx` | 46 |
| **Total** | **809** |

### GuestManager.tsx Split (514 → 164 lines parent + 5 sub-components)

| File | Lines |
|------|-------|
| `GuestManager.tsx` (parent) | 164 |
| `guest/constants.ts` | 60 |
| `guest/GuestHeader.tsx` | 46 |
| `guest/GuestSearch.tsx` | 30 |
| `guest/GuestList.tsx` | 78 |
| `guest/GuestDetail.tsx` | 141 |
| `guest/GuestFormModal.tsx` | 216 |
| **Total** | **735** |

## Pattern Rules Followed
1. ✅ All queries and mutations remain in parent, data/callbacks passed as props
2. ✅ All sub-components are `memo` wrapped with named exports
3. ✅ Sub-components are lazy-loaded with `next/dynamic` + `ssr: false`
4. ✅ Shared types/constants go to `[component]/constants.ts`
5. ✅ Proper TypeScript interfaces for all props
6. ✅ Unused callback parameters in type definitions prefixed with `_`
7. ✅ Slovenian language comments maintained throughout
8. ✅ No setState inside useEffect — used onOpenChange handlers instead
9. ✅ Used `htmlFor` + `id` pairs for label-input associations (added to GuestFormModal)
10. ✅ Used `aria-label` where appropriate

## Verification
- ESLint: 0 errors, 0 warnings
- TypeScript: 0 errors
