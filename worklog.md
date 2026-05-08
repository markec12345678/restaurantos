---
Task ID: 1
Agent: Main Agent
Task: Implement all missing features for the Slovenian restaurant POS system

Work Log:
- Reviewed current project state: 14+ Prisma models, 22+ API routes, 13 POS components
- Identified missing features: HACCP UI, Settings UI, Recipe Manager, FURS integration, storno, PWA
- Created HaccpManager.tsx - full HACCP management with 5 category tabs, templates, date filtering
- Created SettingsManager.tsx - 4 tabs (Company, Tax/DDV, FURS, Receipt), FURS connection test
- Created RecipeManager.tsx - multi-ingredient recipes with margin analysis per menu item
- Created FURS API (/api/furs/route.ts) - fiscal verification, ZOI generation, storno, stock deduction
- Updated ReceiptDialog.tsx - added FURS verification button, storno button, auto-verify on print
- Updated Sidebar.tsx - added Recepti (BookOpen), Nastavitve (Settings) nav items
- Updated page.tsx - registered RecipeManager, SettingsManager modules
- Updated layout.tsx - PWA manifest, Slovenian lang, apple-web-app meta
- Created public/manifest.json - PWA manifest for Android/iOS tablet support
- Build successful - all 38+ routes compile without errors

Stage Summary:
- All major missing features now implemented
- FURS fiscal verification system with ZOI/EOR generation
- Storno receipt functionality
- Multi-ingredient recipe management with margin analysis
- HACCP management with temperature, cleaning, delivery, cooling, training logs
- Settings with FURS cert config, DDV rate management, receipt preview
- PWA support for multi-device (Android tablet, iPad)
- Full Slovenian UI throughout
