---
Task ID: 4
Agent: main
Task: Implement table→order linking, enhanced payment, search, and notifications

Work Log:
- Added editingOrderId/editingOrderNumber to Zustand store for tracking order editing mode
- Created POST /api/orders/[id]/add-items API endpoint - adds items and recalculates totals
- Updated TableMap: "Dodaj artikle k naročilu #XX" button on each active order in table dialog
- Updated OrderPanel: editing mode shows "Dodaj k #XX" header, back button, modified submit text
- Added tip and totalWithTip fields to Order Prisma model, ran db push
- Added splitCount field to Order model for split payment tracking
- Updated order PUT API to accept tip, totalWithTip, splitCount fields
- Enhanced PaymentDialog: cash quick amounts (€5-100), auto-change calculation, split payment with method selection, mešano (mixed) option
- Updated financial report API to use order.tip field for totalTips
- Improved search: Ctrl+K/Cmd+K keyboard shortcut, Escape to close, larger visible search button
- Enhanced GlobalNotifications: polling reduced to 5s, added low-stock badge polling (60s), low-stock indicator button
- Build successful with all 30+ API routes

Stage Summary:
- Full table→order flow complete: click occupied table → see orders → add items to existing order
- Enhanced payment: tip presets (0/5/10/15/20%), custom tip, quick cash amounts, split bill (2-6 people), mešano payment
- Search: Ctrl+K shortcut, visible button, instant filtering across all items
- Notifications: order sounds (new/ready/payment), low-stock visual badge, 5s polling
