---
Task ID: 2
Agent: main
Task: Implement financial reporting, booking extracts (knjiženje), and period-based reporting

Work Log:
- Created /api/reports/financial API with full financial reporting
- Supports 4 period types: daily, weekly, monthly, yearly
- Calculates: total revenue, subtotal, tax, discounts, avg order value
- Payment method breakdown (normalized: cash→gotovina, card→kartica, valuto→kartica)
- Order type breakdown (dine-in, takeaway, delivery)
- Category revenue breakdown
- Item-level sales breakdown
- Time distribution charts (by hour for daily, by day for weekly/monthly, by month for yearly)
- Cost analysis: procurement costs, COGS, write-offs, gross profit/margin
- Cash register data integration
- Booking entries (knjižbeni zapis) with proper Slovenian accounting accounts (1140, 7600, 2530)
- Period-over-period comparison (revenue change %, order change %)
- Date navigation (previous/next period)
- Completely rewrote ReportsView.tsx with 6 tabs
- Built successfully

Stage Summary:
- 6 report tabs: Pregled (30-day overview), Dnevno, Tedensko, Mesečno, Letno, Izpiski
- Each period tab has: key metrics with trend comparison, time distribution chart, payment method pie, category bar chart, top items list, cost analysis
- Izpiski tab: full booking entry with debit/credit accounts, category breakdown table, item breakdown table, order statistics
- Print button for extracts
- Date navigation with prev/next buttons
