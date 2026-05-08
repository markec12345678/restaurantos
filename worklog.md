---
Task ID: 1
Agent: main
Task: Implement inventory procurement (nabava) and write-off (razknjižba) system

Work Log:
- Added StockTransaction model to Prisma schema with full audit trail
- Ran npx prisma db push successfully
- Created API endpoint POST /api/inventory/restock for procurement entry
- Created API endpoint POST /api/inventory/adjust for write-offs and adjustments
- Created API endpoint GET /api/inventory/transactions for transaction history with filters
- Updated inventory APIs to auto-calculate costPerServing
- Updated PUT /api/orders/[id] to auto-deduct inventory on order completion based on normativi
- Installed shadcn/ui Tabs and Textarea components
- Completely rewrote InventoryManager.tsx with 4 tabs: Zaloge, Nabava, Razknjižbe, Zgodovina
- Built project successfully

Stage Summary:
- Full procurement workflow: select item, enter quantity/cost/supplier doc, creates transaction record
- Full write-off workflow: select item, enter quantity/type/reason, creates transaction record
- Auto-deduction on order completion using servingsPerUnit normativ
- Transaction history with filters by type, date range, and summary statistics
- Inventory cards show normativi info, margin calculations, quick restock/write-off buttons
