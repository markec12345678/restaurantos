# Task 4: Split SettingsManager Component

## Summary
Split `src/components/pos/SettingsManager.tsx` (1,175 lines) into 7 files in `src/components/pos/settings/`.

## Files Created
- `constants.ts` (102 lines) — Types: SettingsData, FursStatus, BatchVerificationResult, BatchVerificationResults, BatchStatus; Props interfaces for all sub-components
- `CountryTab.tsx` (226 lines) — Country selection + summary card
- `CompanyTab.tsx` (110 lines) — Company data form + receipt header preview
- `TaxTab.tsx` (207 lines) — Tax rates, bulk VAT change, currency/language
- `FursTab.tsx` (358 lines) — Fiscalization settings, FursBatchVerification (internal), country-specific info
- `ReceiptTab.tsx` (115 lines) — Receipt footer, preview, storno info
- `SettingsStatusBar.tsx` (44 lines) — Bottom status bar

## Files Modified
- `SettingsManager.tsx` (1,175 → 272 lines) — Now composes lazy-loaded sub-components

## Key Decisions
- FursBatchVerification kept internal to FursTab.tsx (only used there, has own state/queries)
- All mutations/queries in parent, props passed down
- All sub-components memo-wrapped
- next/dynamic + ssr: false for lazy loading

## Verification
- ESLint: 0 errors, 0 warnings ✅
- TypeScript: 0 errors ✅
- Full lint: 0 errors ✅
