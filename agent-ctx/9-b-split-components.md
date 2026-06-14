# Task 9-b: Split LocationManager.tsx and VisualFloorPlan.tsx

## Summary
Split two large POS components into smaller sub-components following the established pattern.

## LocationManager.tsx Split (628 → 926 lines, 8 files)

| File | Lines | Description |
|------|-------|-------------|
| LocationManager.tsx | 329 | Parent (queries/mutations/handlers) |
| location/constants.tsx | 170 | Shared types, constants, props interfaces |
| location/LocationStats.tsx | 25 | Stats cards |
| location/MenuSyncSection.tsx | 83 | Menu sync card |
| location/DeliveryZonesSection.tsx | 115 | Delivery zones card + add form |
| location/LocationForm.tsx | 55 | Create location form |
| location/LocationsList.tsx | 115 | Locations list with expandable cards |
| location/DeleteDialog.tsx | 34 | Delete confirmation dialog |

**Parent reduced: 628 → 329 lines (48%)**

## VisualFloorPlan.tsx Split (601 → 816 lines, 6 files)

| File | Lines | Description |
|------|-------|-------------|
| VisualFloorPlan.tsx | 367 | Parent (queries/mutations/memoized values) |
| floorplan/constants.ts | 140 | Shared types, constants, props interfaces |
| floorplan/FloorTableItem.tsx | 57 | Individual table component |
| floorplan/FloorPlanCanvas.tsx | 104 | Floor plan canvas with grid/tables |
| floorplan/SelectedTableFooter.tsx | 47 | Selected table action footer |
| floorplan/TableDialog.tsx | 101 | Add/edit table dialog |

**Parent reduced: 601 → 367 lines (39%)**

## Pattern Compliance
- ✅ All sub-components memo-wrapped with named exports
- ✅ Lazy-loaded with next/dynamic + ssr: false
- ✅ Queries/mutations remain in parent
- ✅ onOpenChange handler (no setState in useEffect)
- ✅ htmlFor + id pairs for label-input
- ✅ aria-label attributes
- ✅ Slovenian comments preserved
- ✅ Unused callback params prefixed with _
- ✅ ESLint: 0 errors, 0 warnings
- ✅ TypeScript: 0 errors in our files

## Issues Fixed
- Renamed location/constants.ts → .tsx for JSX support in typeIcons
- Removed unused Badge import from FloorPlanCanvas.tsx
- Prefixed unused params in type definitions with _
- Fixed union type access on zonesData in DeliveryZonesSection.tsx
