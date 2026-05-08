---
Task ID: 1
Agent: Main Agent
Task: Implement Toast POS improvements - bug fixes, analytics, seed data

Work Log:
- Fixed Store.ts: Added missing `taxRate`, `appliedDiscountId`, `diningOptionId` fields with defaults
- Fixed OrderPanel: Replaced hardcoded "Davek (10%)" with multi-DDV breakdown display showing each VAT rate (22%, 9.5%, 0%) separately
- Fixed ReceiptDialog: Added missing `import { toast } from 'sonner'`
- Fixed Add-items API: Replaced flat 22% tax calculation with per-item VAT rate from menu items
- Enhanced Dashboard API: Added 8 new analytics endpoints (category breakdown, hourly revenue, DDV breakdown, payment method, order type, top items, employee performance, avg wait time)
- Enhanced Dashboard UI: Added PieChart for categories, LineChart for hourly revenue, order type breakdown, DDV breakdown by rate, top selling items, delivery quick access
- Added configuration seed data: 3 tax rates, 3 dining options, 4 revenue centers, 5 sales categories, 4 price groups, 5 prep stations, 5 void reasons, 3 no-sale reasons, 4 alt payment types, 3 discounts, 3 printers, 1 webhook, 5 jobs with Slovenian permissions
- Build test: PASSED

Stage Summary:
- All critical bugs fixed (missing taxRate in store, hardcoded 10% tax, missing toast import, flat 22% VAT)
- Dashboard now has comprehensive analytics with 8 data dimensions
- Configuration tables now have Slovenian default seed data (14 model types)
- Build passes successfully
