# Task 5 — Refactor ReservationManager.tsx

## Agent: Main Agent

## Task
Split `/home/z/my-project/src/components/pos/ReservationManager.tsx` (709 lines) into smaller sub-components following the established pattern.

## Work Completed

### File Structure Created
```
src/components/pos/
├── ReservationManager.tsx          (236 lines — parent, queries/mutations, dynamic imports)
└── reservation/
    ├── constants.ts                (94 lines — types, constants, props interfaces)
    ├── ReservationCard.tsx         (110 lines — memo-wrapped card component)
    ├── TimelineView.tsx            (75 lines — memo-wrapped timeline view)
    ├── ListView.tsx                (38 lines — memo-wrapped list view)
    └── ReservationDialog.tsx       (228 lines — memo-wrapped dialog with form)
```

### Pattern Compliance
1. ✅ All queries and mutations remain in parent component, data/callbacks passed as props
2. ✅ All sub-components are `memo` wrapped with named exports
3. ✅ Sub-components are lazy-loaded with `next/dynamic` + `ssr: false`
4. ✅ Shared types/constants go to `reservation/constants.ts`
5. ✅ Proper TypeScript interfaces for all props
6. ✅ Unused callback parameters prefixed with `_`
7. ✅ Slovenian language comments maintained throughout
8. ✅ No setState inside useEffect — uses onOpenChange handler
9. ✅ `htmlFor` + `id` pairs for label-input associations
10. ✅ `aria-label` where appropriate

### Validation Results
- ESLint: 0 errors, 0 warnings
- TypeScript: 0 errors

### Line Count Summary
| File | Lines |
|------|-------|
| Original ReservationManager.tsx | 710 |
| **New ReservationManager.tsx** | **236** |
| reservation/constants.ts | 94 |
| reservation/ReservationCard.tsx | 110 |
| reservation/TimelineView.tsx | 75 |
| reservation/ListView.tsx | 38 |
| reservation/ReservationDialog.tsx | 228 |
| **Total** | **781** |

### Issues Encountered
- 12 ESLint warnings on first run (unused imports in parent: Card, CardContent, Clock, Users, Phone; unused import in ReservationDialog: Badge). All fixed by removing unused imports.
- No TypeScript errors at any stage.
