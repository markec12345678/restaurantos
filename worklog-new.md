---
Task ID: manager-full-test
Agent: Main Agent
Task: Manager test - full workflow testing of inventory, sales, and financial reports

Work Log:
- Fixed 3 WRONG inventory→menu links and correctly linked 23 inventory items with proper normativi
- Fixed DDV rate from 10% to 22% (Slovenian standard) in store.ts, orders API, add-items API
- Fixed floating point precision in inventory deduction
- Tested NABAVA, ODPIS, PRODAJA - all working correctly
- Verified RAZKNJIŽEVANJE works perfectly (inventory deducts on order completion)
- Tested all financial reports: daily (570.45€), weekly (4185.12€), monthly, yearly
- Verified Slovenian accounting entries (konti: 1140, 2400, 7600, 2530)
- Build successful

Stage Summary:
- ALL core POS functions tested and working: inventory management, procurement, write-offs, sales, inventory auto-deduction, financial reports, accounting entries
- DDV correctly set to 22% throughout system
- Inventory deduction verified with multiple test orders
