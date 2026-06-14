# Task 6-a: Split KitchenDisplay.tsx into kitchen/ subdirectory

## Summary
Split `KitchenDisplay.tsx` (1,011 lines) into 6 focused sub-modules under `src/components/pos/kitchen/` plus a slimmed-down parent.

## Files Created
1. `kitchen/types.ts` (48 lines) — `OrderItemWithMenu`, `EnrichedOrder`, `KDSData` interfaces
2. `kitchen/kitchen-sound.ts` (98 lines) — `KitchenSoundManager` class + `soundManager` singleton (no React deps)
3. `kitchen/use-fullscreen.ts` (24 lines) — `useFullscreen` hook (no date-fns)
4. `kitchen/WaitTimer.tsx` (38 lines) — `WaitTimer` memo component
5. `kitchen/KitchenOrderItem.tsx` (139 lines) — `KitchenOrderItem` memo component with local statusConfig
6. `kitchen/KitchenOrderCard.tsx` (246 lines) — `KitchenOrderCard` memo component (uses format from date-fns, WaitTimer, KitchenOrderItem)

## Files Modified
- `KitchenDisplay.tsx` (1,011 → 440 lines) — imports from `./kitchen/`, all queries/mutations/WebSocket logic retained

## Verification
- `npx eslint src/components/pos/KitchenDisplay.tsx src/components/pos/kitchen/` → 0 errors, 0 warnings
- `npx tsc --noEmit` → 0 errors in kitchen files
