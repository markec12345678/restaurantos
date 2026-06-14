# Task 4 - Split RecipeManager.tsx into Sub-Components

## Summary
Split the 734-line RecipeManager.tsx into 6 files following the established pattern.

## Files Created
1. `src/components/pos/recipe/constants.ts` (113 lines) - Shared types and helper functions
2. `src/components/pos/recipe/RecipeTab.tsx` (306 lines) - Recipes tab with MenuItemList + RecipeDetail
3. `src/components/pos/recipe/MarginsTab.tsx` (197 lines) - Margins tab with MarginStatsCards + MarginTable + MarginLegend
4. `src/components/pos/recipe/AddRecipeDialog.tsx` (150 lines) - Add ingredient dialog
5. `src/components/pos/recipe/EditRecipeDialog.tsx` (98 lines) - Edit ingredient dialog

## File Modified
- `src/components/pos/RecipeManager.tsx` (734 → 307 lines) - Now imports sub-components via next/dynamic

## Pattern Compliance
- ✅ All queries and mutations remain in parent component
- ✅ All sub-components are memo-wrapped with named exports
- ✅ Sub-components lazy-loaded with next/dynamic + ssr:false
- ✅ Shared types/constants in recipe/constants.ts
- ✅ Proper TypeScript interfaces for all props
- ✅ Unused callback parameters prefixed with `_`
- ✅ Slovenian language comments maintained
- ✅ htmlFor + id pairs for label-input associations
- ✅ aria-label attributes where appropriate

## Issues Fixed
- ESLint: 16 warnings for unused callback parameters in type definitions → prefixed with `_`
- TypeScript: `selectedItem` could be `undefined` from `Array.find()` → added `?? null`

## Final Status
- ESLint: 0 errors, 0 warnings
- TypeScript: 0 errors
