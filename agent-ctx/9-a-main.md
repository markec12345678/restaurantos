# Task 9-a: Split ReceiptDialog.tsx and MenuManager.tsx into sub-components

## Status: COMPLETED

## Summary
Split two large component files into smaller sub-components following the established pattern from previous tasks (ReservationManager, StaffScheduler, RecipeManager, etc.)

## ReceiptDialog Split (651 → 4 files, 760 lines total)
- `ReceiptDialog.tsx` (326 lines) — parent with queries, mutations, QR effect, handlers, Dialog wrapper
- `receipt/constants.ts` (113 lines) — types (ReceiptItem, VatBreakdownItem, ReceiptData), label maps, props interfaces
- `receipt/ActionButtons.tsx` (71 lines) — action buttons (confirm+print, copy, print, email, SMS, FURS verify, storno)
- `receipt/ReceiptContent.tsx` (250 lines) — receipt body (business header, items, DDV, payment, FURS, QR, footer)
- Parent reduced by 50%

## MenuManager Split (642 → 8 files, 941 lines total)
- `MenuManager.tsx` (295 lines) — parent with queries, mutations, handlers, Tabs shell
- `menu/constants.ts` (147 lines) — types, form state interfaces, props interfaces
- `menu/ItemsTab.tsx` (189 lines) — items tab with search, filters, grid/list
- `menu/CategoriesTab.tsx` (58 lines) — categories tab
- `menu/MenusTab.tsx` (63 lines) — menus tab
- `menu/ModifiersTab.tsx` (55 lines) — modifiers tab
- `menu/ItemDialog.tsx` (123 lines) — item create/edit dialog
- `menu/CategoryDialog.tsx` (62 lines) — category create dialog
- `menu/MenuDialog.tsx` (49 lines) — menu create dialog
- Parent reduced by 54%

## Quality Checks
- ESLint: 0 errors, 0 warnings in our files
- TypeScript: 0 errors in our files
- Pattern compliance: memo-wrapped named exports, dynamic imports with ssr:false, shared constants, proper TypeScript interfaces, htmlFor+id, aria-labels, Slovenian comments preserved
